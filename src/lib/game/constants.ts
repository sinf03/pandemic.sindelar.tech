import type { DiseaseKey, GamePhase, PlayerRole } from '$lib/supabase/types';

export const DISEASE_KEYS: DiseaseKey[] = ['rubra', 'viridis', 'nox', 'aurum'];

export const DISEASE_THEMES = {
	clinical: {
		rubra: 'Rubra',
		viridis: 'Viridis',
		nox: 'Nox',
		aurum: 'Aurum'
	},
	scout: {
		rubra: 'Rudý kašel',
		viridis: 'Zelená horečka',
		nox: 'Černý stín',
		aurum: 'Zlatá zimnice'
	}
} as const satisfies Record<'clinical' | 'scout', Record<DiseaseKey, string>>;

export type DiseaseTheme = keyof typeof DISEASE_THEMES;

export const ROLE_LABELS: Record<PlayerRole, { name: string; ability: string }> = {
	koordinator: {
		name: 'Koordinátor',
		ability: 'Jednou za hru může zrušit špatné týmové rozhodnutí.'
	},
	epidemiolog: {
		name: 'Epidemiolog',
		ability: 'Vidí, která města se nakazí v dalším kole.'
	},
	medik: {
		name: 'Medik',
		ability: 'Léčí o 2 stupně místo 1.'
	},
	logistik: {
		name: 'Logistik',
		ability: 'Nese 2 zdroje zároveň.'
	},
	vyzkumnik: {
		name: 'Výzkumník',
		ability: 'Sleva na vývoj léku.'
	},
	spojka_a: {
		name: 'Spojka A',
		ability: 'Smí utíkat i při nákaze 1. stupně.'
	},
	spojka_b: {
		name: 'Spojka B',
		ability: 'Smí utíkat i při nákaze 1. stupně.'
	},
	technik: {
		name: 'Technik',
		ability: 'Opraví stanici poškozenou krizí.'
	}
};

export const PHASE_LABELS: Record<GamePhase, string> = {
	porada: 'Porada',
	akce: 'Akce',
	vyhodnoceni: 'Vyhodnocení',
	sireni: 'Šíření'
};

export const PHASE_ORDER: GamePhase[] = ['porada', 'akce', 'vyhodnoceni', 'sireni'];

export const DEFAULT_SETTINGS = {
	theme: 'clinical' as DiseaseTheme,
	round_count: 12,
	phase_durations_s: {
		porada: 60,
		akce: 360, // 6 min
		vyhodnoceni: 60,
		sireni: 30 // mostly auto
	},
	pandemic_lose_at: 8,
	infection_spread_per_round: 3,
	epidemic_every_n: 3,
	cure_cost: 4,
	// Per-player chance to also catch the spreading disease in each city during
	// Šíření. ~0.18 keeps movement rules occasionally in play without ramping.
	player_infect_chance_during_spread: 0.18,
	win_condition: 'lenient' as 'strict' | 'lenient'
};

export type GameSettings = typeof DEFAULT_SETTINGS;

/** The stage rule shown on the player's phone. Hard rule: never lift, never one-leg. */
export const MOVEMENT_RULES: Record<0 | 1 | 2 | 3, { label: string; detail: string }> = {
	0: {
		label: 'Volný pohyb',
		detail: 'Můžeš se pohybovat normálně.'
	},
	1: {
		label: 'Jen chůze',
		detail: 'Nesmíš běhat. Choď klidně.'
	},
	2: {
		label: 'Chůze s omezením',
		detail: 'Choď s rukama za zády, nebo s parťákem za ruku — podle dnešního pravidla.'
	},
	3: {
		label: 'Doprovod nutný',
		detail: 'Nemůžeš jít sám. Doprovází tě 1–2 spoluhráči, nikdy tě nezvedají.'
	}
};
