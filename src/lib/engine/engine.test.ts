import { describe, expect, it } from 'vitest';
import type { MapPayload } from '$lib/supabase/types';
import { DEFAULT_SETTINGS } from '$lib/game/constants';
import {
	advanceCure,
	advancePhase,
	applyInfection,
	checkOutcome,
	epidemic,
	infectionStep,
	infectPlayer,
	neighborsOf,
	newGameState,
	rollbackCure,
	seedInitialInfections
} from './engine';
import { seededRng } from './rng';
import type { GameMeta, GameState } from './types';

const sampleMap: MapPayload = {
	cities: [
		{ id: 'a', name: 'Anava', x: 0.1, y: 0.1, color: 'rubra' },
		{ id: 'b', name: 'Borka', x: 0.2, y: 0.2, color: 'rubra' },
		{ id: 'c', name: 'Cedar', x: 0.3, y: 0.3, color: 'viridis' },
		{ id: 'd', name: 'Drava', x: 0.4, y: 0.4, color: 'viridis' },
		{ id: 'e', name: 'Eden', x: 0.5, y: 0.5, color: 'nox' },
		{ id: 'f', name: 'Farun', x: 0.6, y: 0.6, color: 'nox' },
		{ id: 'g', name: 'Gora', x: 0.7, y: 0.7, color: 'aurum' },
		{ id: 'h', name: 'Halza', x: 0.8, y: 0.8, color: 'aurum' }
	],
	edges: [
		['a', 'b'],
		['b', 'c'],
		['c', 'd'],
		['d', 'e'],
		['e', 'f'],
		['f', 'g'],
		['g', 'h'],
		['a', 'c'], // bridge
		['e', 'g'] // bridge
	]
};

function freshMeta(overrides: Partial<GameMeta> = {}): GameMeta {
	return {
		id: 'g1',
		code: 'TESTAB',
		status: 'active',
		settings: { ...DEFAULT_SETTINGS },
		pandemic_count: 0,
		current_round: 1,
		current_phase: 'porada',
		phase_ends_at: null,
		finish_reason: null,
		...overrides
	};
}

function freshState(metaOverrides: Partial<GameMeta> = {}): GameState {
	return newGameState({ gameMeta: freshMeta(metaOverrides), map: sampleMap });
}

describe('newGameState', () => {
	it('builds diseases, cities, edges in the expected shape', () => {
		const s = freshState();
		expect(s.diseases).toHaveLength(4);
		expect(s.diseases.map((d) => d.key)).toEqual(['rubra', 'viridis', 'nox', 'aurum']);
		expect(s.diseases.every((d) => d.cure_stage === 0 && !d.cured)).toBe(true);
		expect(s.cities).toHaveLength(8);
		expect(s.cities.every((c) => Object.values(c.infection_levels).every((v) => v === 0))).toBe(true);
		expect(s.edges).toHaveLength(9);
	});

	it('uses scout theme names when configured', () => {
		const s = freshState({ settings: { ...DEFAULT_SETTINGS, theme: 'scout' } });
		expect(s.diseases.find((d) => d.key === 'nox')?.name).toBe('Černý stín');
	});
});

describe('neighborsOf', () => {
	it('lists neighbors for both edge directions', () => {
		const s = freshState();
		const ns = neighborsOf(s, 'c');
		expect(new Set(ns)).toEqual(new Set(['b', 'd', 'a']));
	});
});

describe('seedInitialInfections', () => {
	function biggerMap(): MapPayload {
		const cities = Array.from({ length: 12 }, (_, i) => ({
			id: `c${i}`,
			name: `City ${i}`,
			x: (i % 4) / 4,
			y: Math.floor(i / 4) / 3,
			color: (['rubra', 'viridis', 'nox', 'aurum'] as const)[i % 4]
		}));
		const edges: Array<[string, string]> = cities.slice(1).map((c, i) => [cities[i].id, c.id]);
		return { cities, edges };
	}

	it('lays down 3+3+4 stages summing to 19 across 10 cities, all on color-matching diseases', () => {
		const s0 = newGameState({ gameMeta: freshMeta(), map: biggerMap() });
		const { state: s1, events } = seedInitialInfections(s0, seededRng(42));
		const stageSum = s1.cities.reduce(
			(acc, c) => acc + Object.values(c.infection_levels).reduce((a, b) => a + b, 0),
			0
		);
		expect(stageSum).toBe(3 * 3 + 3 * 2 + 4 * 1);
		expect(events).toHaveLength(10);

		for (const c of s1.cities) {
			for (const [k, v] of Object.entries(c.infection_levels)) {
				if (v > 0) expect(k).toBe(c.color);
			}
		}
	});

	it('infects up to min(N, total cities) on a small map without throwing', () => {
		const s0 = freshState(); // 8 cities; less than 10
		const { state: s1, events } = seedInitialInfections(s0, seededRng(42));
		const infected = s1.cities.filter((c) =>
			Object.values(c.infection_levels).some((v) => v > 0)
		);
		expect(infected.length).toBeLessThanOrEqual(s0.cities.length);
		expect(events.length).toBe(infected.length);
	});

	it('is deterministic for the same seed', () => {
		const a = seedInitialInfections(freshState(), seededRng(7)).state;
		const b = seedInitialInfections(freshState(), seededRng(7)).state;
		expect(a.cities.map((c) => c.infection_levels)).toEqual(b.cities.map((c) => c.infection_levels));
	});
});

describe('applyInfection', () => {
	it('bumps stage from 0 → 1 → 2 → 3 with no pandemic', () => {
		let s = freshState();
		for (let i = 1; i <= 3; i++) {
			const r = applyInfection(s, 'a', 'rubra', seededRng(1));
			s = r.state;
			expect(s.cities.find((c) => c.key === 'a')?.infection_levels.rubra).toBe(i);
			expect(s.game.pandemic_count).toBe(0);
		}
	});

	it('triggers pandemic on the 4th infection at stage 3 and spreads to neighbors', () => {
		let s = freshState();
		// Manually push 'a' to stage 3
		s = {
			...s,
			cities: s.cities.map((c) =>
				c.key === 'a' ? { ...c, infection_levels: { ...c.infection_levels, rubra: 3 } } : c
			)
		};
		const r = applyInfection(s, 'a', 'rubra', seededRng(1));
		const out = r.state;

		expect(out.game.pandemic_count).toBe(1);
		// 'a' has neighbors 'b' and 'c'
		expect(out.cities.find((c) => c.key === 'b')?.infection_levels.rubra).toBe(1);
		expect(out.cities.find((c) => c.key === 'c')?.infection_levels.rubra).toBe(1);
		// 'a' stayed at 3
		expect(out.cities.find((c) => c.key === 'a')?.infection_levels.rubra).toBe(3);

		const pandemicEvents = r.events.filter((e) => e.kind === 'pandemic');
		expect(pandemicEvents).toHaveLength(1);
		expect(pandemicEvents[0]).toMatchObject({ city_key: 'a', disease: 'rubra', chain_depth: 0 });
	});

	it('chains pandemics through neighbors that are already at stage 3', () => {
		let s = freshState();
		s = {
			...s,
			cities: s.cities.map((c) => {
				if (c.key === 'a' || c.key === 'b' || c.key === 'c') {
					return { ...c, infection_levels: { ...c.infection_levels, rubra: 3 } };
				}
				return c;
			})
		};
		const r = applyInfection(s, 'a', 'rubra', seededRng(1));
		const out = r.state;
		// Three cities pandemic'd: a, b (neighbor of a), c (neighbor of a). c is connected to b and d.
		expect(out.game.pandemic_count).toBeGreaterThanOrEqual(3);

		const pandemicEvents = r.events.filter((e) => e.kind === 'pandemic');
		const triggered = new Set(pandemicEvents.map((e) => `${e.city_key}:${e.disease}`));
		expect(triggered.has('a:rubra')).toBe(true);
		expect(triggered.has('b:rubra')).toBe(true);
		expect(triggered.has('c:rubra')).toBe(true);
		// No city should pandemic twice (no infinite loop)
		expect(pandemicEvents.length).toBe(triggered.size);
	});

	it('skips infection on quarantined cities', () => {
		let s = freshState();
		s = {
			...s,
			cities: s.cities.map((c) => (c.key === 'a' ? { ...c, in_quarantine: true } : c))
		};
		const r = applyInfection(s, 'a', 'rubra', seededRng(1));
		expect(r.state.cities.find((c) => c.key === 'a')?.infection_levels.rubra).toBe(0);
		expect(r.events).toHaveLength(0);
	});

	it('skips infection on eradicated diseases', () => {
		let s = freshState();
		s = {
			...s,
			diseases: s.diseases.map((d) => (d.key === 'rubra' ? { ...d, eradicated: true, cured: true, cure_stage: 4 } : d))
		};
		const r = applyInfection(s, 'a', 'rubra', seededRng(1));
		expect(r.state.cities.find((c) => c.key === 'a')?.infection_levels.rubra).toBe(0);
	});

	it('skips infection on merely cured (not yet eradicated) diseases', () => {
		let s = freshState();
		s = {
			...s,
			diseases: s.diseases.map((d) =>
				d.key === 'rubra' ? { ...d, cured: true, cure_stage: 4 } : d
			),
			// pre-seed a leftover infection so the cure isn't auto-eradicated
			cities: s.cities.map((c) =>
				c.key === 'b' ? { ...c, infection_levels: { ...c.infection_levels, rubra: 1 } } : c
			)
		};
		const r = applyInfection(s, 'a', 'rubra', seededRng(1));
		expect(r.state.cities.find((c) => c.key === 'a')?.infection_levels.rubra).toBe(0);
		expect(r.events).toHaveLength(0);
	});

	it('cured disease does not spread via pandemic chain either', () => {
		let s = freshState();
		s = {
			...s,
			diseases: s.diseases.map((d) =>
				d.key === 'rubra' ? { ...d, cured: true, cure_stage: 4 } : d
			),
			cities: s.cities.map((c) =>
				c.key === 'a' ? { ...c, infection_levels: { rubra: 3, viridis: 0, nox: 0, aurum: 0 } } : c
			)
		};
		const r = applyInfection(s, 'a', 'rubra', seededRng(1));
		// no pandemic, no neighbor spread
		expect(r.state.game.pandemic_count).toBe(0);
		expect(r.state.cities.find((c) => c.key === 'b')?.infection_levels.rubra).toBe(0);
	});
});

describe('infectionStep', () => {
	it('infects exactly N distinct cities with color-matching diseases', () => {
		const s = freshState();
		const r = infectionStep(s, { count: 3, rng: seededRng(99) });
		const infectionEvents = r.events.filter((e) => e.kind === 'infection');
		expect(infectionEvents).toHaveLength(3);

		const targetedCityKeys = new Set(infectionEvents.map((e) => e.kind === 'infection' && e.city_key));
		expect(targetedCityKeys.size).toBe(3);

		for (const e of infectionEvents) {
			if (e.kind !== 'infection') continue;
			const city = r.state.cities.find((c) => c.key === e.city_key);
			expect(city?.color).toBe(e.disease);
		}
	});

	it('does not pick cities whose regional disease has been cured', () => {
		let s = freshState();
		s = {
			...s,
			diseases: s.diseases.map((d) =>
				d.key === 'rubra' ? { ...d, cured: true, cure_stage: 4 } : d
			)
		};
		const r = infectionStep(s, { count: 3, rng: seededRng(99) });
		const infectionEvents = r.events.filter((e) => e.kind === 'infection');
		for (const e of infectionEvents) {
			if (e.kind === 'infection') expect(e.disease).not.toBe('rubra');
		}
	});

	it('emits player_infect events occasionally during spread', () => {
		const players = Array.from({ length: 6 }, (_, i) => ({
			id: `p${i}`,
			display_name: `P${i}`,
			role: null,
			is_admin: false,
			slot_index: i,
			infection_levels: { rubra: 0, viridis: 0, nox: 0, aurum: 0 },
			current_city_key: null,
			carry_limit: 1
		}));
		const s: GameState = {
			...freshState({
				settings: { ...DEFAULT_SETTINGS, player_infect_chance_during_spread: 1 }
			}),
			players
		};
		const r = infectionStep(s, { count: 3, rng: seededRng(1) });
		const pInfects = r.events.filter((e) => e.kind === 'player_infect');
		// chance=1 + 6 players × 3 picks = up to 18 player infections (capped per
		// player at stage 3). At least some must fire.
		expect(pInfects.length).toBeGreaterThan(0);
	});

	it('never infects players with a cured disease during spread', () => {
		const players = [
			{
				id: 'p1',
				display_name: 'P1',
				role: null,
				is_admin: false,
				slot_index: 0,
				infection_levels: { rubra: 0, viridis: 0, nox: 0, aurum: 0 },
				current_city_key: null,
				carry_limit: 1
			}
		];
		let s: GameState = {
			...freshState({
				settings: { ...DEFAULT_SETTINGS, player_infect_chance_during_spread: 1 }
			}),
			players
		};
		// cure rubra and keep an infection of viridis active so the step still has
		// targets to draw from
		s = {
			...s,
			diseases: s.diseases.map((d) => (d.key === 'rubra' ? { ...d, cured: true, cure_stage: 4 } : d))
		};
		const r = infectionStep(s, { count: 3, rng: seededRng(2) });
		const pInfects = r.events.filter((e) => e.kind === 'player_infect');
		for (const e of pInfects) {
			if (e.kind === 'player_infect') expect(e.disease).not.toBe('rubra');
		}
	});
});

describe('advancePhase', () => {
	it('cycles porada → akce → vyhodnoceni → sireni → porada and bumps round on wrap', () => {
		let s = freshState({ current_phase: 'porada', current_round: 1 });
		const phases = ['akce', 'vyhodnoceni', 'sireni', 'porada'] as const;
		const expectedRounds = [1, 1, 1, 2];

		for (let i = 0; i < phases.length; i++) {
			const r = advancePhase(s, { now: new Date('2026-05-20T10:00:00Z'), rng: seededRng(i + 1) });
			s = r.state;
			expect(s.game.current_phase).toBe(phases[i]);
			expect(s.game.current_round).toBe(expectedRounds[i]);
		}
	});

	it('sets phase_ends_at based on settings.phase_durations_s', () => {
		const s = freshState({
			current_phase: 'porada',
			settings: {
				...DEFAULT_SETTINGS,
				phase_durations_s: { porada: 60, akce: 300, vyhodnoceni: 60, sireni: 10 }
			}
		});
		const now = new Date('2026-05-20T10:00:00Z');
		const r = advancePhase(s, { now, rng: seededRng(1) });
		expect(r.state.game.phase_ends_at).toBe('2026-05-20T10:05:00.000Z');
	});

	it('runs infection step when entering sireni', () => {
		let s = freshState({ current_phase: 'vyhodnoceni' });
		const r = advancePhase(s, { now: new Date(), rng: seededRng(123) });
		expect(r.state.game.current_phase).toBe('sireni');
		const infections = r.events.filter((e) => e.kind === 'infection');
		expect(infections.length).toBeGreaterThan(0);
	});

	it('returns unchanged state if game is not active', () => {
		const s = freshState({ status: 'lobby' });
		const r = advancePhase(s, { now: new Date(), rng: seededRng(1) });
		expect(r.state).toEqual(s);
		expect(r.events).toEqual([]);
	});

	it('finishes the game on lose condition (pandemic counter)', () => {
		const s = freshState({
			current_phase: 'akce',
			pandemic_count: 7, // one away from 8
			settings: { ...DEFAULT_SETTINGS, pandemic_lose_at: 8 }
		});
		// Force every step to pandemic by maxing out one city. Push 'a' to stage 3
		// on every disease so the next infection guarantees a pandemic chain.
		const seeded: GameState = {
			...s,
			cities: s.cities.map((c) =>
				c.key === 'a'
					? { ...c, infection_levels: { rubra: 3, viridis: 3, nox: 3, aurum: 3 } }
					: c.key === 'b'
						? { ...c, infection_levels: { rubra: 3, viridis: 0, nox: 0, aurum: 0 } }
						: c
			)
		};
		// Skip to sireni via two phase advances
		let next = advancePhase(seeded, { now: new Date(), rng: seededRng(1) });
		next = advancePhase(next.state, { now: new Date(), rng: seededRng(2) });
		// Eventually game should finish — keep advancing up to a few times to ensure
		for (let i = 0; i < 5 && next.state.game.status !== 'finished'; i++) {
			next = advancePhase(next.state, { now: new Date(), rng: seededRng(i + 3) });
		}
		expect(next.state.game.status).toBe('finished');
		expect(next.state.game.finish_reason).toMatch(/Pandemie/i);
	});
});

describe('advanceCure / rollbackCure', () => {
	it('walks cure_stage 0→1→2→3→4 and marks cured at 4', () => {
		let s = freshState();
		for (let i = 1; i <= 4; i++) {
			const r = advanceCure(s, 'rubra');
			s = r.state;
			const d = s.diseases.find((x) => x.key === 'rubra');
			expect(d?.cure_stage).toBe(i);
			expect(d?.cured).toBe(i === 4);
		}
	});

	it('eradicates a cured disease if no infections remain', () => {
		let s = freshState();
		s = {
			...s,
			diseases: s.diseases.map((d) => (d.key === 'rubra' ? { ...d, cure_stage: 3 } : d))
		};
		const r = advanceCure(s, 'rubra');
		expect(r.state.diseases.find((d) => d.key === 'rubra')?.eradicated).toBe(true);
		expect(r.events.some((e) => e.kind === 'disease_eradicated')).toBe(true);
	});

	it('does NOT eradicate if infections still exist', () => {
		let s = freshState();
		s = {
			...s,
			diseases: s.diseases.map((d) => (d.key === 'rubra' ? { ...d, cure_stage: 3 } : d)),
			cities: s.cities.map((c) =>
				c.key === 'a' ? { ...c, infection_levels: { ...c.infection_levels, rubra: 2 } } : c
			)
		};
		const r = advanceCure(s, 'rubra');
		expect(r.state.diseases.find((d) => d.key === 'rubra')?.cured).toBe(true);
		expect(r.state.diseases.find((d) => d.key === 'rubra')?.eradicated).toBe(false);
	});

	it('rollbackCure decreases stage and resets cured/eradicated flags', () => {
		let s = freshState();
		s = {
			...s,
			diseases: s.diseases.map((d) =>
				d.key === 'rubra' ? { ...d, cure_stage: 4, cured: true, eradicated: true } : d
			)
		};
		const r = rollbackCure(s, 'rubra', 2);
		const d = r.state.diseases.find((x) => x.key === 'rubra');
		expect(d?.cure_stage).toBe(2);
		expect(d?.cured).toBe(false);
		expect(d?.eradicated).toBe(false);
	});
});

describe('checkOutcome', () => {
	it('continues when nothing extraordinary happened', () => {
		const s = freshState();
		expect(checkOutcome(s).kind).toBe('continue');
	});

	it('declares lose when pandemic counter reaches the threshold', () => {
		const s = freshState({ pandemic_count: 8 });
		expect(checkOutcome(s).kind).toBe('lose');
	});

	it('declares lose when rounds run out', () => {
		const s = freshState({ current_round: DEFAULT_SETTINGS.round_count + 1 });
		expect(checkOutcome(s).kind).toBe('lose');
	});

	it('declares win (lenient) when all diseases cured', () => {
		let s = freshState();
		s = {
			...s,
			diseases: s.diseases.map((d) => ({ ...d, cure_stage: 4, cured: true }))
		};
		const out = checkOutcome(s);
		expect(out.kind).toBe('win');
	});

	it('strict mode requires no remaining infections', () => {
		let s = freshState({
			settings: { ...DEFAULT_SETTINGS, win_condition: 'strict' }
		});
		s = {
			...s,
			diseases: s.diseases.map((d) => ({ ...d, cure_stage: 4, cured: true })),
			cities: s.cities.map((c) =>
				c.key === 'a' ? { ...c, infection_levels: { ...c.infection_levels, rubra: 1 } } : c
			)
		};
		expect(checkOutcome(s).kind).toBe('continue');
		// Clean it
		s = {
			...s,
			cities: s.cities.map((c) =>
				c.key === 'a' ? { ...c, infection_levels: { rubra: 0, viridis: 0, nox: 0, aurum: 0 } } : c
			)
		};
		expect(checkOutcome(s).kind).toBe('win');
	});
});

describe('epidemic', () => {
	it('jumps a single city to stage 3 and runs a normal infection step on top', () => {
		const s = freshState();
		const r = epidemic(s, seededRng(11));
		// Total stages should be at least 3 (from the bumped city) + N (from step)
		const totalStages = r.state.cities.reduce(
			(acc, c) => acc + Object.values(c.infection_levels).reduce((a, b) => a + b, 0),
			0
		);
		expect(totalStages).toBeGreaterThanOrEqual(3 + s.game.settings.infection_spread_per_round);
	});
});

describe('infectPlayer', () => {
	it('bumps a player infection stage and clamps at 3', () => {
		const player = {
			id: 'p1',
			display_name: 'Alice',
			role: null,
			is_admin: false,
			slot_index: 0,
			infection_levels: { rubra: 0, viridis: 0, nox: 0, aurum: 0 },
			current_city_key: null,
			carry_limit: 1
		};
		const s: GameState = { ...freshState(), players: [player] };
		let next = infectPlayer(s, 'p1', 'rubra', 1);
		expect(next.state.players[0].infection_levels.rubra).toBe(1);
		next = infectPlayer(next.state, 'p1', 'rubra', 5);
		expect(next.state.players[0].infection_levels.rubra).toBe(3);
	});
});
