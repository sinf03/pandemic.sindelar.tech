import type { DiseaseKey, GamePhase, MapPayload } from '$lib/supabase/types';
import { DISEASE_THEMES, PHASE_ORDER, type GameSettings } from '$lib/game/constants';
import {
	ALL_DISEASES,
	emptyLevels,
	type CityKey,
	type CityState,
	type DiseaseState,
	type EngineEvent,
	type EngineResult,
	type GameMeta,
	type GameState,
	type Outcome
} from './types';
import { pick, sample, shuffle, type Rng } from './rng';

/* ============================================================
 * STATE BUILDERS
 * ============================================================ */

export function buildInitialDiseases(theme: GameSettings['theme']): DiseaseState[] {
	const names = DISEASE_THEMES[theme];
	return ALL_DISEASES.map((key) => ({
		key,
		name: names[key],
		cure_stage: 0,
		cured: false,
		eradicated: false
	}));
}

export function buildInitialCities(payload: MapPayload): CityState[] {
	return payload.cities.map((c) => ({
		id: c.id, // caller may override with real DB id
		key: c.id,
		name: c.name,
		color: c.color,
		x: c.x,
		y: c.y,
		infection_levels: emptyLevels(),
		has_station: c.station ?? false,
		in_quarantine: false,
		quarantine_until_round: null,
		removed: false
	}));
}

/**
 * Seed the standard 3+3+4 starting infection pattern from original Pandemic.
 * Picks 10 distinct random cities, all infected with their own color (color matches
 * the regional disease).
 */
export function seedInitialInfections(state: GameState, rng: Rng): EngineResult {
	const cities = state.cities.filter((c) => !c.removed);
	const picks = sample(cities, 10, rng);
	const distribution = [3, 3, 3, 2, 2, 2, 1, 1, 1, 1];
	const events: EngineEvent[] = [];
	const nextCities = state.cities.map((c) => ({ ...c, infection_levels: { ...c.infection_levels } }));

	picks.forEach((city, i) => {
		const stage = Math.min(3, distribution[i] ?? 1);
		const idx = nextCities.findIndex((c) => c.key === city.key);
		if (idx < 0) return;
		nextCities[idx].infection_levels[city.color] = stage;
		events.push({
			kind: 'infection',
			city_key: city.key,
			disease: city.color,
			new_stage: stage
		});
	});

	return { state: { ...state, cities: nextCities }, events };
}

/* ============================================================
 * INFECTION + PANDEMIC CHAIN
 * ============================================================ */

/**
 * Apply +1 infection to (city, disease). If the city is already at stage 3,
 * triggers a pandemic that spreads to neighbors. Pandemic chains track which
 * (city, disease) pairs have already triggered this turn so we don't loop.
 */
export function applyInfection(
	state: GameState,
	cityKey: CityKey,
	disease: DiseaseKey,
	rng: Rng,
	options: { chainDepth?: number; triggered?: Set<string> } = {}
): EngineResult {
	const chainDepth = options.chainDepth ?? 0;
	const triggered = options.triggered ?? new Set<string>();

	let s = state;
	const events: EngineEvent[] = [];

	const city = s.cities.find((c) => c.key === cityKey);
	if (!city || city.removed) return { state: s, events };

	const disease_state = s.diseases.find((d) => d.key === disease);
	// Cured/eradicated diseases stop spreading entirely (RULES.md: "Lék hotov:
	// nemoc se přestane dál šířit"). This applies to natural spread, pandemic
	// chains and crisis-driven infection alike.
	if (disease_state?.cured || disease_state?.eradicated) return { state: s, events };

	if (city.in_quarantine) {
		return { state: s, events }; // quarantine blocks infection
	}

	const currentStage = city.infection_levels[disease] ?? 0;
	const triggerKey = `${cityKey}:${disease}`;

	if (currentStage < 3) {
		const newStage = currentStage + 1;
		s = updateCity(s, cityKey, (c) => ({
			...c,
			infection_levels: { ...c.infection_levels, [disease]: newStage }
		}));
		events.push({ kind: 'infection', city_key: cityKey, disease, new_stage: newStage });
		return { state: s, events };
	}

	// Pandemic. Cap at 3 (already there), increment pandemic counter, spread.
	if (triggered.has(triggerKey)) return { state: s, events }; // already exploded this turn
	triggered.add(triggerKey);

	s = {
		...s,
		game: { ...s.game, pandemic_count: s.game.pandemic_count + 1 }
	};
	events.push({ kind: 'pandemic', city_key: cityKey, disease, chain_depth: chainDepth });

	const neighborKeys = neighborsOf(s, cityKey);
	for (const nk of neighborKeys) {
		const r = applyInfection(s, nk, disease, rng, { chainDepth: chainDepth + 1, triggered });
		s = r.state;
		events.push(...r.events);
	}

	return { state: s, events };
}

/**
 * Standard turn-end infection step: draw N cities and infect each with its own
 * color-matching disease. Skips cities whose regional disease is already cured —
 * a cured disease does not spread, so we'd just waste the draw.
 *
 * Side-effect: each non-admin player has a small chance to also catch the
 * disease that just hit a city this step (RULES require players to occasionally
 * pick up infection during Šíření, not only via crises).
 */
export function infectionStep(
	state: GameState,
	options: { count: number; rng: Rng }
): EngineResult {
	const curedSet = new Set(state.diseases.filter((d) => d.cured).map((d) => d.key));
	const eligible = state.cities.filter(
		(c) => !c.removed && !c.in_quarantine && !curedSet.has(c.color)
	);
	const picks = sample(eligible, options.count, options.rng);
	let s = state;
	const events: EngineEvent[] = [];
	for (const city of picks) {
		const r = applyInfection(s, city.key, city.color, options.rng);
		s = r.state;
		events.push(...r.events);
		const playerEvents = rollPlayerInfectionDuringSpread(s, city.color, options.rng);
		for (const pe of playerEvents) {
			const upd = infectPlayer(s, pe.player_id, city.color, 1);
			s = upd.state;
			events.push(...upd.events);
		}
	}
	return { state: s, events };
}

/**
 * Per-player probability of catching the disease that's actively spreading this
 * step. ~18% per non-admin player per affected city — at typical settings (3
 * picks/round, ~6 players) that produces ~1 player infection every other
 * spread phase, which keeps movement rules in play without snowballing.
 *
 * Returns just the list of (player_id) to infect; the caller applies them
 * sequentially so each `infectPlayer` call sees the latest state.
 */
function rollPlayerInfectionDuringSpread(
	state: GameState,
	disease: DiseaseKey,
	rng: Rng
): Array<{ player_id: string }> {
	const diseaseState = state.diseases.find((d) => d.key === disease);
	if (diseaseState?.cured || diseaseState?.eradicated) return [];
	const chance = state.game.settings.player_infect_chance_during_spread ?? 0.18;
	const out: Array<{ player_id: string }> = [];
	for (const p of state.players) {
		if (p.is_admin) continue;
		if ((p.infection_levels[disease] ?? 0) >= 3) continue;
		if (rng() < chance) out.push({ player_id: p.id });
	}
	return out;
}

/**
 * Epidemic: a stronger event. In original rules, pull the bottom of the
 * infection deck and add 3 cubes. We model it as: pick one random non-quarantine
 * city, jump straight to stage 3 (triggering pandemic if already at 3),
 * then a single infectionStep on top.
 */
export function epidemic(state: GameState, rng: Rng): EngineResult {
	const curedSet = new Set(state.diseases.filter((d) => d.cured).map((d) => d.key));
	const eligible = state.cities.filter(
		(c) => !c.removed && !c.in_quarantine && !curedSet.has(c.color)
	);
	if (eligible.length === 0) return { state, events: [] };
	const target = pick(eligible, rng);
	let s = state;
	const events: EngineEvent[] = [];
	// bump to 3 in one go: apply infection 3 times (stops at pandemic naturally)
	for (let i = 0; i < 3; i++) {
		const stage = s.cities.find((c) => c.key === target.key)?.infection_levels[target.color] ?? 0;
		if (stage >= 3) break;
		const r = applyInfection(s, target.key, target.color, rng);
		s = r.state;
		events.push(...r.events);
	}
	// Then a normal step
	const step = infectionStep(s, { count: s.game.settings.infection_spread_per_round, rng });
	s = step.state;
	events.push(...step.events);
	return { state: s, events };
}

/* ============================================================
 * PHASE ADVANCEMENT
 * ============================================================ */

export function advancePhase(
	state: GameState,
	options: { now: Date; rng: Rng }
): EngineResult {
	if (state.game.status !== 'active') {
		return { state, events: [] };
	}

	const currentPhase = state.game.current_phase ?? 'porada';
	const nextIdx = (PHASE_ORDER.indexOf(currentPhase) + 1) % PHASE_ORDER.length;
	const nextPhase = PHASE_ORDER[nextIdx];
	const isWrap = nextIdx === 0; // sireni -> porada → new round
	const nextRound = isWrap ? state.game.current_round + 1 : state.game.current_round;

	let s = state;
	const events: EngineEvent[] = [];

	// When entering 'sireni', run the infection step. If wrapping past sireni
	// we already did the step on entering it; here we just bump the round.
	if (nextPhase === 'sireni') {
		const isEpidemic =
			state.game.settings.epidemic_every_n > 0 &&
			nextRound > 0 &&
			state.game.current_round % state.game.settings.epidemic_every_n === 0 &&
			state.game.current_round > 0;
		const r = isEpidemic
			? epidemic(s, options.rng)
			: infectionStep(s, { count: s.game.settings.infection_spread_per_round, rng: options.rng });
		s = r.state;
		events.push(...r.events);
	}

	// Clear expired quarantines at the start of each new round
	if (isWrap) {
		s = {
			...s,
			cities: s.cities.map((c) => {
				if (
					c.in_quarantine &&
					c.quarantine_until_round != null &&
					nextRound > c.quarantine_until_round
				) {
					return { ...c, in_quarantine: false, quarantine_until_round: null };
				}
				return c;
			})
		};
	}

	const phaseSeconds = s.game.settings.phase_durations_s[nextPhase] ?? 60;
	const phaseEndsAt = new Date(options.now.getTime() + phaseSeconds * 1000).toISOString();

	s = {
		...s,
		game: {
			...s.game,
			current_phase: nextPhase,
			current_round: nextRound,
			phase_ends_at: phaseEndsAt
		}
	};
	events.push({ kind: 'phase_start', round: nextRound, phase: nextPhase, phase_ends_at: phaseEndsAt });

	// Outcome check after each phase advance
	const outcome = checkOutcome(s);
	if (outcome.kind !== 'continue') {
		s = {
			...s,
			game: {
				...s.game,
				status: 'finished',
				finish_reason: outcome.reason
			}
		};
		events.push({ kind: 'outcome', outcome: outcome.kind, reason: outcome.reason });
	}

	return { state: s, events };
}

/* ============================================================
 * CURE DEVELOPMENT
 * ============================================================ */

export function advanceCure(state: GameState, disease: DiseaseKey): EngineResult {
	const events: EngineEvent[] = [];
	const d = state.diseases.find((x) => x.key === disease);
	if (!d || d.cured) return { state, events };
	const newStage = Math.min(4, d.cure_stage + 1);
	const cured = newStage >= 4;
	const nextDiseases = state.diseases.map((x) =>
		x.key === disease ? { ...x, cure_stage: newStage, cured } : x
	);
	events.push({ kind: 'cure_step', disease, new_stage: newStage });
	if (cured) events.push({ kind: 'cure_done', disease });

	let s: GameState = { ...state, diseases: nextDiseases };

	// Eradication check: cured disease + no infections of it anywhere
	if (cured) {
		const noInfections = s.cities.every((c) => (c.infection_levels[disease] ?? 0) === 0);
		if (noInfections) {
			s = {
				...s,
				diseases: s.diseases.map((x) => (x.key === disease ? { ...x, eradicated: true } : x))
			};
			events.push({ kind: 'disease_eradicated', disease });
		}
	}

	return { state: s, events };
}

export function rollbackCure(state: GameState, disease: DiseaseKey, phases: number): EngineResult {
	const d = state.diseases.find((x) => x.key === disease);
	if (!d) return { state, events: [] };
	const newStage = Math.max(0, d.cure_stage - phases);
	const nextDiseases = state.diseases.map((x) =>
		x.key === disease
			? { ...x, cure_stage: newStage, cured: newStage >= 4, eradicated: false }
			: x
	);
	return {
		state: { ...state, diseases: nextDiseases },
		events: [{ kind: 'cure_step', disease, new_stage: newStage }]
	};
}

/* ============================================================
 * OUTCOME
 * ============================================================ */

export function checkOutcome(state: GameState): Outcome {
	const lose_at = state.game.settings.pandemic_lose_at ?? 8;
	if (state.game.pandemic_count >= lose_at) {
		return { kind: 'lose', reason: `Pandemie překročila ${lose_at}.` };
	}
	if (state.game.current_round > state.game.settings.round_count) {
		return { kind: 'lose', reason: 'Vypršel čas — vakcína nestihla.' };
	}
	const allCured = state.diseases.every((d) => d.cured);
	if (!allCured) return { kind: 'continue' };

	const winMode = state.game.settings.win_condition ?? 'lenient';
	if (winMode === 'strict') {
		const allClean = state.cities.every(
			(c) => Object.values(c.infection_levels).every((v) => v <= 0)
		);
		if (allClean) return { kind: 'win', reason: 'Všechny léky vyvinuty a svět vyčištěn.' };
		return { kind: 'continue' };
	}
	return { kind: 'win', reason: 'Všechny léky vyvinuty.' };
}

/* ============================================================
 * HELPERS
 * ============================================================ */

export function neighborsOf(state: GameState, cityKey: CityKey): CityKey[] {
	const out: CityKey[] = [];
	for (const [a, b] of state.edges) {
		if (a === cityKey) out.push(b);
		else if (b === cityKey) out.push(a);
	}
	return out;
}

export function cityByKey(state: GameState, key: CityKey): CityState | undefined {
	return state.cities.find((c) => c.key === key);
}

function updateCity(
	state: GameState,
	cityKey: CityKey,
	update: (c: CityState) => CityState
): GameState {
	return {
		...state,
		cities: state.cities.map((c) => (c.key === cityKey ? update(c) : c))
	};
}

export function infectPlayer(
	state: GameState,
	playerId: string,
	disease: DiseaseKey,
	amount = 1
): EngineResult {
	const events: EngineEvent[] = [];
	const p = state.players.find((x) => x.id === playerId);
	if (!p) return { state, events };
	const current = p.infection_levels[disease] ?? 0;
	const newStage = Math.max(0, Math.min(3, current + amount));
	const nextPlayers = state.players.map((x) =>
		x.id === playerId
			? { ...x, infection_levels: { ...x.infection_levels, [disease]: newStage } }
			: x
	);
	events.push({ kind: 'player_infect', player_id: playerId, disease, new_stage: newStage });
	return { state: { ...state, players: nextPlayers }, events };
}

/* ============================================================
 * CONSTRUCTING A FRESH STATE FROM SCRATCH (testing + e2e bootstrap)
 * ============================================================ */

export function newGameState(opts: {
	gameMeta: GameMeta;
	map: MapPayload;
	players?: GameState['players'];
}): GameState {
	const diseases = buildInitialDiseases(opts.gameMeta.settings.theme);
	const cities = buildInitialCities(opts.map);
	const edges = opts.map.edges.map(([a, b]) => [a, b] as [CityKey, CityKey]);
	return {
		game: opts.gameMeta,
		players: opts.players ?? [],
		cities,
		diseases,
		edges,
		map_payload: opts.map
	};
}

export { sample, shuffle, pick } from './rng';
