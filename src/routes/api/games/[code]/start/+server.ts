import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin, readBody } from '$lib/server/auth';
import { loadDbState, applyEngineResult } from '$lib/engine/persistence';
import { seedInitialInfections } from '$lib/engine';
import { seededRng } from '$lib/engine/rng';
import { DEFAULT_SETTINGS, DISEASE_KEYS, DISEASE_THEMES } from '$lib/game/constants';
import { getAdminSupabase } from '$lib/supabase/admin';
import type { GameMeta } from '$lib/engine/types';
import type { DiseaseTheme } from '$lib/game/constants';

type Body = { device_token: string };

export const POST: RequestHandler = async (event) => {
	const body = await readBody<Body>(event);
	const supabase = getAdminSupabase();
	const { loaded } = await loadDbState(supabase, event.params.code!);
	await requireAdmin(supabase, loaded.game.id, body.device_token);

	if (loaded.game.status !== 'lobby') {
		throw error(409, 'Hra už byla spuštěna.');
	}
	if (loaded.players.length === 0) {
		throw error(400, 'Nemůžeš spustit hru bez hráčů.');
	}

	const settings = {
		...DEFAULT_SETTINGS,
		...((loaded.game.settings as Partial<typeof DEFAULT_SETTINGS> | null) ?? {})
	};
	const theme = (settings.theme === 'scout' ? 'scout' : 'clinical') as DiseaseTheme;
	const themeNames = DISEASE_THEMES[theme];

	// 1. Seed diseases (idempotent)
	const diseaseRows = DISEASE_KEYS.map((k) => ({
		game_id: loaded.game.id,
		key: k,
		name: themeNames[k],
		color_token: k
	}));
	const { error: diseaseErr } = await supabase
		.from('diseases')
		.upsert(diseaseRows, { onConflict: 'game_id,key' });
	if (diseaseErr) throw error(500, diseaseErr.message);

	// 2. Seed cities from map (idempotent)
	const cityRows = loaded.map.payload.cities.map((c) => ({
		game_id: loaded.game.id,
		map_city_key: c.id,
		name: c.name,
		x: c.x,
		y: c.y,
		color_token: c.color,
		has_station: !!c.station,
		infection_levels: {}
	}));
	const { error: cityErr } = await supabase
		.from('game_cities')
		.upsert(cityRows, { onConflict: 'game_id,map_city_key' });
	if (cityErr) throw error(500, cityErr.message);

	// 3. Reload full state now that diseases + cities exist, then seed infections.
	const reloaded = await loadDbState(supabase, event.params.code!);
	const rng = seededRng(seedFor(loaded.game.id, 'start'));
	const seeded = seedInitialInfections(reloaded.state, rng);

	// 4. Move game to active state on phase 'porada'
	const poradaSeconds = settings.phase_durations_s.porada;
	const now = new Date();
	const ends = new Date(now.getTime() + poradaSeconds * 1000).toISOString();
	const nextMeta: GameMeta = {
		...seeded.state.game,
		status: 'active',
		current_round: 1,
		current_phase: 'porada',
		phase_ends_at: ends
	};
	const finalResult = {
		state: { ...seeded.state, game: nextMeta },
		events: [
			...seeded.events,
			{
				kind: 'phase_start' as const,
				round: 1,
				phase: 'porada' as const,
				phase_ends_at: ends
			}
		]
	};

	await applyEngineResult(supabase, reloaded.state, finalResult);
	// also persist started_at separately (not modeled in engine meta)
	await supabase
		.from('games')
		.update({ started_at: now.toISOString() })
		.eq('id', loaded.game.id);

	return json({ ok: true });
};

function seedFor(gameId: string, tag: string): number {
	let h = 0;
	const s = `${gameId}:${tag}`;
	for (let i = 0; i < s.length; i++) {
		h = (h * 31 + s.charCodeAt(i)) >>> 0;
	}
	return h || 1;
}
