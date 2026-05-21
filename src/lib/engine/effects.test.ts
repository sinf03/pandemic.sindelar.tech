import { describe, expect, it } from 'vitest';
import { applyCrisisEffects, type CrisisEffect } from './effects';
import { newGameState } from './engine';
import { seededRng } from './rng';
import { DEFAULT_SETTINGS } from '$lib/game/constants';
import type { GameMeta } from './types';
import type { MapPayload } from '$lib/supabase/types';

const tinyMap: MapPayload = {
	cities: [
		{ id: 'a', name: 'A', x: 0.1, y: 0.1, color: 'rubra', station: true },
		{ id: 'b', name: 'B', x: 0.2, y: 0.2, color: 'viridis' },
		{ id: 'c', name: 'C', x: 0.3, y: 0.3, color: 'nox' },
		{ id: 'd', name: 'D', x: 0.4, y: 0.4, color: 'aurum' }
	],
	edges: [
		['a', 'b'],
		['b', 'c'],
		['c', 'd']
	]
};

function makeMeta(overrides: Partial<GameMeta> = {}): GameMeta {
	return {
		id: 'g1',
		code: 'TEST01',
		status: 'active',
		settings: DEFAULT_SETTINGS,
		pandemic_count: 0,
		current_round: 1,
		current_phase: 'akce',
		phase_ends_at: null,
		finish_reason: null,
		...overrides
	};
}

describe('applyCrisisEffects', () => {
	it('pandemic_add bumps pandemic counter and emits a pandemic event', () => {
		const state = newGameState({ gameMeta: makeMeta(), map: tinyMap });
		const effects: CrisisEffect[] = [{ kind: 'pandemic_add', amount: 2 }];
		const r = applyCrisisEffects(state, effects, { rng: seededRng(1) });
		expect(r.state.game.pandemic_count).toBe(2);
		expect(r.events.filter((e) => e.kind === 'pandemic')).toHaveLength(1);
	});

	it('cure_rollback retreats progress and clears cured flag', () => {
		const state = newGameState({ gameMeta: makeMeta(), map: tinyMap });
		// pre-set rubra to cured
		state.diseases = state.diseases.map((d) =>
			d.key === 'rubra' ? { ...d, cure_stage: 4, cured: true } : d
		);
		const r = applyCrisisEffects(state, [{ kind: 'cure_rollback', phases: 2, disease: 'rubra' }], {
			rng: seededRng(2)
		});
		const rubra = r.state.diseases.find((d) => d.key === 'rubra')!;
		expect(rubra.cure_stage).toBe(2);
		expect(rubra.cured).toBe(false);
	});

	it('cure_advance progresses by N phases and can cure at 4', () => {
		const state = newGameState({ gameMeta: makeMeta(), map: tinyMap });
		const r = applyCrisisEffects(state, [{ kind: 'cure_advance', phases: 4, disease: 'viridis' }], {
			rng: seededRng(3)
		});
		const v = r.state.diseases.find((d) => d.key === 'viridis')!;
		expect(v.cure_stage).toBe(4);
		expect(v.cured).toBe(true);
		expect(r.events.some((e) => e.kind === 'cure_done')).toBe(true);
	});

	it('quarantine_random flags exactly one city as quarantined', () => {
		const state = newGameState({ gameMeta: makeMeta(), map: tinyMap });
		const r = applyCrisisEffects(state, [{ kind: 'quarantine_random', rounds: 2 }], {
			rng: seededRng(4)
		});
		const quarantined = r.state.cities.filter((c) => c.in_quarantine);
		expect(quarantined).toHaveLength(1);
		expect(quarantined[0].quarantine_until_round).toBe(3);
	});

	it('player_infect raises the chosen player infection stage', () => {
		const state = newGameState({ gameMeta: makeMeta(), map: tinyMap });
		state.players = [
			{
				id: 'p1',
				display_name: 'Hráč',
				role: null,
				is_admin: false,
				slot_index: 0,
				infection_levels: { rubra: 0, viridis: 0, nox: 0, aurum: 0 },
				current_city_key: null,
				carry_limit: 1
			}
		];
		const r = applyCrisisEffects(
			state,
			[{ kind: 'player_infect', amount: 2, disease: 'nox', player_id: 'p1' }],
			{ rng: seededRng(5) }
		);
		expect(r.state.players[0].infection_levels.nox).toBe(2);
	});
});
