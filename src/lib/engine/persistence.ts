/**
 * Bridge between Supabase rows and the pure-TS engine GameState.
 *
 * `loadEngineState` builds a GameState from DB rows so engine fns can compute a
 * new state. `applyEngineResult` diffs the new state against the previous one
 * and writes only the changed rows back, plus one events_log row per
 * EngineEvent.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { error } from '@sveltejs/kit';
import { loadGameByCode, type LoadedGame } from '$lib/game/load';
import { DEFAULT_SETTINGS, DISEASE_THEMES } from '$lib/game/constants';
import type {
	Database,
	DiseaseKey,
	GameCityRow,
	GameRow,
	DiseaseRow,
	PlayerRow
} from '$lib/supabase/types';
import { ALL_DISEASES, emptyLevels } from './types';
import type {
	CityState,
	DiseaseState,
	EngineEvent,
	EngineResult,
	GameMeta,
	GameState,
	PlayerEngineState
} from './types';

export type DbState = {
	loaded: LoadedGame;
	state: GameState;
};

function levelsFrom(raw: unknown): Record<DiseaseKey, number> {
	const out = emptyLevels();
	if (typeof raw !== 'object' || raw === null) return out;
	const m = raw as Record<string, unknown>;
	for (const k of ALL_DISEASES) {
		const v = m[k];
		if (typeof v === 'number') out[k] = Math.max(0, Math.min(3, Math.round(v)));
	}
	return out;
}

function gameMetaFrom(row: GameRow): GameMeta {
	const settings = {
		...DEFAULT_SETTINGS,
		...((row.settings as Partial<typeof DEFAULT_SETTINGS> | null) ?? {})
	};
	return {
		id: row.id,
		code: row.code,
		status: row.status,
		settings,
		pandemic_count: row.pandemic_count,
		current_round: row.current_round,
		current_phase: row.current_phase,
		phase_ends_at: row.phase_ends_at,
		finish_reason: row.finish_reason
	};
}

function cityStateFrom(row: GameCityRow): CityState {
	return {
		id: row.id,
		key: row.map_city_key,
		name: row.name,
		color: row.color_token as DiseaseKey,
		x: row.x,
		y: row.y,
		infection_levels: levelsFrom(row.infection_levels),
		has_station: row.has_station,
		in_quarantine: row.in_quarantine,
		quarantine_until_round: null,
		removed: row.removed
	};
}

function diseaseStateFrom(row: DiseaseRow): DiseaseState {
	return {
		key: row.key,
		name: row.name,
		cure_stage: row.cure_stage,
		cured: row.cured,
		eradicated: row.eradicated
	};
}

function playerStateFrom(row: PlayerRow): PlayerEngineState {
	return {
		id: row.id,
		display_name: row.display_name,
		role: row.role,
		is_admin: row.is_admin,
		slot_index: row.slot_index,
		infection_levels: levelsFrom(row.infection_levels),
		current_city_key: null,
		carry_limit: row.carry_limit
	};
}

export async function loadDbState(
	supabase: SupabaseClient<Database>,
	code: string
): Promise<DbState> {
	const loaded = await loadGameByCode(supabase, code);
	const meta = gameMetaFrom(loaded.game);
	const state: GameState = {
		game: meta,
		players: loaded.players.map(playerStateFrom),
		cities: loaded.cities.map(cityStateFrom),
		diseases: loaded.diseases.map(diseaseStateFrom),
		edges: loaded.map.payload.edges,
		map_payload: loaded.map.payload
	};
	// If diseases haven't been seeded yet (lobby), build them so engine fns work
	if (state.diseases.length === 0) {
		const names = DISEASE_THEMES[meta.settings.theme];
		state.diseases = ALL_DISEASES.map((k) => ({
			key: k,
			name: names[k],
			cure_stage: 0,
			cured: false,
			eradicated: false
		}));
	}
	return { loaded, state };
}

export async function applyEngineResult(
	supabase: SupabaseClient<Database>,
	prev: GameState,
	result: EngineResult
): Promise<void> {
	const { state: next, events } = result;
	await writeGameDiff(supabase, prev, next);
	await writeCityDiffs(supabase, prev, next);
	await writeDiseaseDiffs(supabase, prev, next);
	await writePlayerDiffs(supabase, prev, next);
	await writeEvents(supabase, prev.game.id, events);
}

async function writeGameDiff(
	supabase: SupabaseClient<Database>,
	prev: GameState,
	next: GameState
): Promise<void> {
	const a = prev.game;
	const b = next.game;
	const patch: Database['public']['Tables']['games']['Update'] = {};
	if (a.status !== b.status) patch.status = b.status;
	if (a.current_phase !== b.current_phase) patch.current_phase = b.current_phase;
	if (a.current_round !== b.current_round) patch.current_round = b.current_round;
	if (a.phase_ends_at !== b.phase_ends_at) patch.phase_ends_at = b.phase_ends_at;
	if (a.pandemic_count !== b.pandemic_count) patch.pandemic_count = b.pandemic_count;
	if (a.finish_reason !== b.finish_reason) patch.finish_reason = b.finish_reason;
	if (Object.keys(patch).length === 0) return;
	if (b.status === 'finished' && !a.status) patch.finished_at = new Date().toISOString();
	if (b.status === 'finished' && a.status !== 'finished')
		patch.finished_at = new Date().toISOString();
	const { error: err } = await supabase.from('games').update(patch).eq('id', b.id);
	if (err) throw error(500, `Failed to update game: ${err.message}`);
}

async function writeCityDiffs(
	supabase: SupabaseClient<Database>,
	prev: GameState,
	next: GameState
): Promise<void> {
	const prevByKey = new Map(prev.cities.map((c) => [c.key, c]));
	for (const c of next.cities) {
		const p = prevByKey.get(c.key);
		if (!p) continue;
		const patch: Database['public']['Tables']['game_cities']['Update'] = {};
		if (!levelsEqual(p.infection_levels, c.infection_levels))
			patch.infection_levels = c.infection_levels;
		if (p.in_quarantine !== c.in_quarantine) patch.in_quarantine = c.in_quarantine;
		if (p.removed !== c.removed) patch.removed = c.removed;
		if (Object.keys(patch).length === 0) continue;
		const { error: err } = await supabase.from('game_cities').update(patch).eq('id', c.id);
		if (err) throw error(500, `Failed to update city: ${err.message}`);
	}
}

async function writeDiseaseDiffs(
	supabase: SupabaseClient<Database>,
	prev: GameState,
	next: GameState
): Promise<void> {
	const prevByKey = new Map(prev.diseases.map((d) => [d.key, d]));
	for (const d of next.diseases) {
		const p = prevByKey.get(d.key);
		if (!p) continue;
		const patch: Database['public']['Tables']['diseases']['Update'] = {};
		if (p.cure_stage !== d.cure_stage) patch.cure_stage = d.cure_stage;
		if (p.cured !== d.cured) patch.cured = d.cured;
		if (p.eradicated !== d.eradicated) patch.eradicated = d.eradicated;
		if (Object.keys(patch).length === 0) continue;
		const { error: err } = await supabase
			.from('diseases')
			.update(patch)
			.eq('game_id', next.game.id)
			.eq('key', d.key);
		if (err) throw error(500, `Failed to update disease: ${err.message}`);
	}
}

async function writePlayerDiffs(
	supabase: SupabaseClient<Database>,
	prev: GameState,
	next: GameState
): Promise<void> {
	const prevById = new Map(prev.players.map((p) => [p.id, p]));
	for (const p of next.players) {
		const old = prevById.get(p.id);
		if (!old) continue;
		const patch: Database['public']['Tables']['players']['Update'] = {};
		if (!levelsEqual(old.infection_levels, p.infection_levels))
			patch.infection_levels = p.infection_levels;
		if (Object.keys(patch).length === 0) continue;
		const { error: err } = await supabase.from('players').update(patch).eq('id', p.id);
		if (err) throw error(500, `Failed to update player: ${err.message}`);
	}
}

async function writeEvents(
	supabase: SupabaseClient<Database>,
	gameId: string,
	events: EngineEvent[]
): Promise<void> {
	if (events.length === 0) return;
	const rows = events.map((ev) => {
		const { kind, ...payload } = ev;
		return { game_id: gameId, kind, payload: payload as unknown as Database['public']['Tables']['events_log']['Insert']['payload'] };
	});
	const { error: err } = await supabase.from('events_log').insert(rows);
	if (err) throw error(500, `Failed to write events: ${err.message}`);
}

function levelsEqual(a: Record<DiseaseKey, number>, b: Record<DiseaseKey, number>): boolean {
	for (const k of ALL_DISEASES) {
		if ((a[k] ?? 0) !== (b[k] ?? 0)) return false;
	}
	return true;
}
