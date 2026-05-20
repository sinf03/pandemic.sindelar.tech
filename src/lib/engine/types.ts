import type { DiseaseKey, GamePhase, GameStatus, PlayerRole, MapPayload } from '$lib/supabase/types';
import type { GameSettings } from '$lib/game/constants';

export type CityKey = string;

export type CityState = {
	id: string;
	key: CityKey;
	name: string;
	color: DiseaseKey;
	x: number;
	y: number;
	infection_levels: Record<DiseaseKey, number>;
	has_station: boolean;
	in_quarantine: boolean;
	quarantine_until_round?: number | null;
	removed: boolean;
};

export type DiseaseState = {
	key: DiseaseKey;
	name: string;
	cure_stage: number;
	cured: boolean;
	eradicated: boolean;
};

export type PlayerEngineState = {
	id: string;
	display_name: string;
	role: PlayerRole | null;
	is_admin: boolean;
	slot_index: number;
	infection_levels: Record<DiseaseKey, number>;
	current_city_key: CityKey | null;
	carry_limit: number;
};

export type GameMeta = {
	id: string;
	code: string;
	status: GameStatus;
	settings: GameSettings;
	pandemic_count: number;
	current_round: number;
	current_phase: GamePhase | null;
	phase_ends_at: string | null;
	finish_reason: string | null;
};

export type GameState = {
	game: GameMeta;
	players: PlayerEngineState[];
	cities: CityState[];
	diseases: DiseaseState[];
	edges: Array<[CityKey, CityKey]>;
	map_payload: MapPayload;
};

export type EngineEvent =
	| { kind: 'phase_start'; round: number; phase: GamePhase; phase_ends_at: string }
	| { kind: 'infection'; city_key: CityKey; disease: DiseaseKey; new_stage: number }
	| { kind: 'pandemic'; city_key: CityKey; disease: DiseaseKey; chain_depth: number }
	| { kind: 'cure_step'; disease: DiseaseKey; new_stage: number }
	| { kind: 'cure_done'; disease: DiseaseKey }
	| { kind: 'disease_eradicated'; disease: DiseaseKey }
	| { kind: 'player_infect'; player_id: string; disease: DiseaseKey; new_stage: number }
	| { kind: 'outcome'; outcome: 'win' | 'lose'; reason: string };

export type EngineResult = {
	state: GameState;
	events: EngineEvent[];
};

export type Outcome =
	| { kind: 'continue' }
	| { kind: 'win'; reason: string }
	| { kind: 'lose'; reason: string };

export const ALL_DISEASES: DiseaseKey[] = ['rubra', 'viridis', 'nox', 'aurum'];

export function emptyLevels(): Record<DiseaseKey, number> {
	return { rubra: 0, viridis: 0, nox: 0, aurum: 0 };
}
