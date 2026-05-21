/**
 * Crisis card effect resolver. Each crisis card option carries an array of
 * effect descriptors; this module applies them to an in-memory GameState and
 * emits engine events alongside the persisted state diff.
 */
import type { Rng } from './rng';
import { pick, sample } from './rng';
import { advanceCure, applyInfection, infectPlayer, rollbackCure } from './engine';
import { ALL_DISEASES } from './types';
import type { EngineEvent, EngineResult, GameState } from './types';
import type { DiseaseKey } from '$lib/supabase/types';

export type CrisisEffect =
	| { kind: 'pandemic_add'; amount?: number }
	| { kind: 'cure_rollback'; phases?: number; disease?: DiseaseKey }
	| { kind: 'cure_advance'; phases?: number; disease?: DiseaseKey }
	| { kind: 'quarantine_random'; rounds?: number }
	| { kind: 'quarantine_choose'; rounds?: number; city_key?: string }
	| { kind: 'station_disable'; rounds?: number; count?: number; all?: boolean }
	| { kind: 'resource_remove'; amount?: number; kind_of?: string }
	| { kind: 'round_timer_cut'; seconds?: number }
	| { kind: 'infection_speed_up'; rounds?: number }
	| { kind: 'player_lock_role'; role?: string; rounds?: number }
	| { kind: 'player_lock_any'; rounds?: number }
	| { kind: 'player_infect'; amount?: number; disease?: DiseaseKey; player_id?: string };

export type ResolveOptions = {
	rng: Rng;
	chosen_player_id?: string;
	chosen_city_key?: string;
	chosen_disease?: DiseaseKey;
};

export function applyCrisisEffects(
	state: GameState,
	effects: CrisisEffect[],
	options: ResolveOptions
): EngineResult {
	let s = state;
	const events: EngineEvent[] = [];
	for (const effect of effects) {
		const r = applyOne(s, effect, options);
		s = r.state;
		events.push(...r.events);
	}
	return { state: s, events };
}

function applyOne(state: GameState, effect: CrisisEffect, options: ResolveOptions): EngineResult {
	switch (effect.kind) {
		case 'pandemic_add': {
			const amount = effect.amount ?? 1;
			return {
				state: {
					...state,
					game: { ...state.game, pandemic_count: state.game.pandemic_count + amount }
				},
				events: [
					{
						kind: 'pandemic',
						city_key: '(crisis)',
						disease: 'rubra',
						chain_depth: 0
					}
				]
			};
		}
		case 'cure_rollback': {
			const phases = effect.phases ?? 1;
			const disease =
				effect.disease ?? options.chosen_disease ?? pickRandomActiveDisease(state, options.rng);
			if (!disease) return { state, events: [] };
			return rollbackCure(state, disease, phases);
		}
		case 'cure_advance': {
			const phases = effect.phases ?? 1;
			const disease =
				effect.disease ?? options.chosen_disease ?? pickRandomActiveDisease(state, options.rng);
			if (!disease) return { state, events: [] };
			let s = state;
			const events: EngineEvent[] = [];
			for (let i = 0; i < phases; i++) {
				const r = advanceCure(s, disease);
				s = r.state;
				events.push(...r.events);
			}
			return { state: s, events };
		}
		case 'quarantine_random': {
			const rounds = effect.rounds ?? 1;
			const eligible = state.cities.filter((c) => !c.removed && !c.in_quarantine);
			if (eligible.length === 0) return { state, events: [] };
			const target = pick(eligible, options.rng);
			return quarantineCity(state, target.key, rounds);
		}
		case 'quarantine_choose': {
			const rounds = effect.rounds ?? 1;
			const key = effect.city_key ?? options.chosen_city_key;
			if (!key) {
				// fallback: random
				const eligible = state.cities.filter((c) => !c.removed && !c.in_quarantine);
				if (eligible.length === 0) return { state, events: [] };
				const target = pick(eligible, options.rng);
				return quarantineCity(state, target.key, rounds);
			}
			return quarantineCity(state, key, rounds);
		}
		case 'player_infect': {
			const amount = effect.amount ?? 1;
			const playerId = effect.player_id ?? options.chosen_player_id;
			const disease =
				effect.disease ?? options.chosen_disease ?? pickRandomActiveDisease(state, options.rng);
			if (!playerId || !disease) {
				// random fallback
				const players = state.players;
				if (players.length === 0) return { state, events: [] };
				const target = pick(players, options.rng);
				const d = disease ?? pickRandomActiveDisease(state, options.rng);
				if (!d) return { state, events: [] };
				return infectPlayer(state, target.id, d, amount);
			}
			return infectPlayer(state, playerId, disease, amount);
		}
		case 'infection_speed_up': {
			// Bump infections in N random cities once.
			const count = state.game.settings.infection_spread_per_round;
			const eligible = state.cities.filter((c) => !c.removed && !c.in_quarantine);
			if (eligible.length === 0) return { state, events: [] };
			const picks = sample(eligible, count, options.rng);
			let s = state;
			const events: EngineEvent[] = [];
			for (const c of picks) {
				const r = applyInfection(s, c.key, c.color, options.rng);
				s = r.state;
				events.push(...r.events);
			}
			return { state: s, events };
		}
		// Effects we don't yet model in the engine. Persist as plain events so the
		// ticker shows them; leader handles physically.
		case 'station_disable':
		case 'resource_remove':
		case 'round_timer_cut':
		case 'player_lock_role':
		case 'player_lock_any':
			return { state, events: [] };
	}
}

function quarantineCity(state: GameState, key: string, rounds: number): EngineResult {
	const cities = state.cities.map((c) =>
		c.key === key
			? {
					...c,
					in_quarantine: true,
					quarantine_until_round: state.game.current_round + rounds
				}
			: c
	);
	return { state: { ...state, cities }, events: [] };
}

function pickRandomActiveDisease(state: GameState, rng: Rng): DiseaseKey | null {
	const active = state.diseases.filter((d) => !d.cured);
	if (active.length === 0) {
		const any = state.diseases.length > 0 ? state.diseases : null;
		if (!any) return ALL_DISEASES[0];
		return pick(any, rng).key;
	}
	return pick(active, rng).key;
}
