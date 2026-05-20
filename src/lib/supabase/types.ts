export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export type Database = {
	__InternalSupabase: {
		PostgrestVersion: '14.5';
	};
	public: {
		Tables: {
			crisis_cards: {
				Row: {
					body: string;
					created_at: string;
					id: string;
					is_active: boolean;
					options: Json;
					tags: string[];
					title: string;
				};
				Insert: {
					body: string;
					created_at?: string;
					id?: string;
					is_active?: boolean;
					options: Json;
					tags?: string[];
					title: string;
				};
				Update: {
					body?: string;
					created_at?: string;
					id?: string;
					is_active?: boolean;
					options?: Json;
					tags?: string[];
					title?: string;
				};
				Relationships: [];
			};
			crisis_draws: {
				Row: {
					applied_at: string | null;
					card_id: string;
					chosen_option: string | null;
					drawn_at: string;
					game_id: string;
					id: string;
					round_id: string | null;
				};
				Insert: {
					applied_at?: string | null;
					card_id: string;
					chosen_option?: string | null;
					drawn_at?: string;
					game_id: string;
					id?: string;
					round_id?: string | null;
				};
				Update: {
					applied_at?: string | null;
					card_id?: string;
					chosen_option?: string | null;
					drawn_at?: string;
					game_id?: string;
					id?: string;
					round_id?: string | null;
				};
				Relationships: [];
			};
			diseases: {
				Row: {
					color_token: string;
					cure_stage: number;
					cured: boolean;
					eradicated: boolean;
					game_id: string;
					id: string;
					key: Database['public']['Enums']['disease_key'];
					name: string;
				};
				Insert: {
					color_token: string;
					cure_stage?: number;
					cured?: boolean;
					eradicated?: boolean;
					game_id: string;
					id?: string;
					key: Database['public']['Enums']['disease_key'];
					name: string;
				};
				Update: {
					color_token?: string;
					cure_stage?: number;
					cured?: boolean;
					eradicated?: boolean;
					game_id?: string;
					id?: string;
					key?: Database['public']['Enums']['disease_key'];
					name?: string;
				};
				Relationships: [];
			};
			events_log: {
				Row: {
					at: string;
					game_id: string;
					id: number;
					kind: string;
					payload: Json;
				};
				Insert: {
					at?: string;
					game_id: string;
					id?: number;
					kind: string;
					payload?: Json;
				};
				Update: {
					at?: string;
					game_id?: string;
					id?: number;
					kind?: string;
					payload?: Json;
				};
				Relationships: [];
			};
			game_cities: {
				Row: {
					color_token: string;
					game_id: string;
					has_station: boolean;
					id: string;
					in_quarantine: boolean;
					infection_levels: Json;
					map_city_key: string;
					name: string;
					removed: boolean;
					x: number;
					y: number;
				};
				Insert: {
					color_token: string;
					game_id: string;
					has_station?: boolean;
					id?: string;
					in_quarantine?: boolean;
					infection_levels?: Json;
					map_city_key: string;
					name: string;
					removed?: boolean;
					x: number;
					y: number;
				};
				Update: {
					color_token?: string;
					game_id?: string;
					has_station?: boolean;
					id?: string;
					in_quarantine?: boolean;
					infection_levels?: Json;
					map_city_key?: string;
					name?: string;
					removed?: boolean;
					x?: number;
					y?: number;
				};
				Relationships: [];
			};
			games: {
				Row: {
					code: string;
					created_at: string;
					created_by: string | null;
					current_phase: Database['public']['Enums']['game_phase'] | null;
					current_round: number;
					finish_reason: string | null;
					finished_at: string | null;
					id: string;
					map_id: string;
					name: string | null;
					pandemic_count: number;
					phase_ends_at: string | null;
					settings: Json;
					started_at: string | null;
					status: Database['public']['Enums']['game_status'];
				};
				Insert: {
					code: string;
					created_at?: string;
					created_by?: string | null;
					current_phase?: Database['public']['Enums']['game_phase'] | null;
					current_round?: number;
					finish_reason?: string | null;
					finished_at?: string | null;
					id?: string;
					map_id: string;
					name?: string | null;
					pandemic_count?: number;
					phase_ends_at?: string | null;
					settings?: Json;
					started_at?: string | null;
					status?: Database['public']['Enums']['game_status'];
				};
				Update: {
					code?: string;
					created_at?: string;
					created_by?: string | null;
					current_phase?: Database['public']['Enums']['game_phase'] | null;
					current_round?: number;
					finish_reason?: string | null;
					finished_at?: string | null;
					id?: string;
					map_id?: string;
					name?: string | null;
					pandemic_count?: number;
					phase_ends_at?: string | null;
					settings?: Json;
					started_at?: string | null;
					status?: Database['public']['Enums']['game_status'];
				};
				Relationships: [];
			};
			maps: {
				Row: {
					created_at: string;
					description: string | null;
					id: string;
					is_template: boolean;
					name: string;
					owner_id: string | null;
					payload: Json;
				};
				Insert: {
					created_at?: string;
					description?: string | null;
					id?: string;
					is_template?: boolean;
					name: string;
					owner_id?: string | null;
					payload: Json;
				};
				Update: {
					created_at?: string;
					description?: string | null;
					id?: string;
					is_template?: boolean;
					name?: string;
					owner_id?: string | null;
					payload?: Json;
				};
				Relationships: [];
			};
			players: {
				Row: {
					carry_limit: number;
					current_city_id: string | null;
					device_token: string;
					display_name: string;
					game_id: string;
					id: string;
					infection_levels: Json;
					is_admin: boolean;
					joined_at: string;
					last_seen_at: string;
					role: Database['public']['Enums']['player_role'] | null;
					slot_index: number;
				};
				Insert: {
					carry_limit?: number;
					current_city_id?: string | null;
					device_token?: string;
					display_name: string;
					game_id: string;
					id?: string;
					infection_levels?: Json;
					is_admin?: boolean;
					joined_at?: string;
					last_seen_at?: string;
					role?: Database['public']['Enums']['player_role'] | null;
					slot_index: number;
				};
				Update: {
					carry_limit?: number;
					current_city_id?: string | null;
					device_token?: string;
					display_name?: string;
					game_id?: string;
					id?: string;
					infection_levels?: Json;
					is_admin?: boolean;
					joined_at?: string;
					last_seen_at?: string;
					role?: Database['public']['Enums']['player_role'] | null;
					slot_index?: number;
				};
				Relationships: [];
			};
			resources: {
				Row: {
					at_city_id: string | null;
					consumed: boolean;
					created_at: string;
					game_id: string;
					held_by_player_id: string | null;
					id: string;
					kind: Database['public']['Enums']['resource_kind'];
				};
				Insert: {
					at_city_id?: string | null;
					consumed?: boolean;
					created_at?: string;
					game_id: string;
					held_by_player_id?: string | null;
					id?: string;
					kind: Database['public']['Enums']['resource_kind'];
				};
				Update: {
					at_city_id?: string | null;
					consumed?: boolean;
					created_at?: string;
					game_id?: string;
					held_by_player_id?: string | null;
					id?: string;
					kind?: Database['public']['Enums']['resource_kind'];
				};
				Relationships: [];
			};
			rounds: {
				Row: {
					ended_at: string | null;
					ends_at: string | null;
					game_id: string;
					id: string;
					number: number;
					phase: Database['public']['Enums']['game_phase'];
					started_at: string;
				};
				Insert: {
					ended_at?: string | null;
					ends_at?: string | null;
					game_id: string;
					id?: string;
					number: number;
					phase: Database['public']['Enums']['game_phase'];
					started_at?: string;
				};
				Update: {
					ended_at?: string | null;
					ends_at?: string | null;
					game_id?: string;
					id?: string;
					number?: number;
					phase?: Database['public']['Enums']['game_phase'];
					started_at?: string;
				};
				Relationships: [];
			};
		};
		Views: Record<string, never>;
		Functions: {
			claim_player_slot: {
				Args: { p_code: string; p_display_name: string };
				Returns: Json;
			};
			create_new_game: {
				Args: { p_leader_name: string; p_map_id: string; p_settings: Json };
				Returns: Json;
			};
			generate_game_code: { Args: { p_length?: number }; Returns: string };
			touch_player_seen: {
				Args: { p_device_token: string };
				Returns: undefined;
			};
		};
		Enums: {
			disease_key: 'rubra' | 'viridis' | 'nox' | 'aurum';
			game_phase: 'porada' | 'akce' | 'vyhodnoceni' | 'sireni';
			game_status: 'lobby' | 'active' | 'paused' | 'finished';
			player_role:
				| 'koordinator'
				| 'epidemiolog'
				| 'medik'
				| 'logistik'
				| 'vyzkumnik'
				| 'spojka_a'
				| 'spojka_b'
				| 'technik';
			resource_kind: 'vzorek' | 'lecivo' | 'energie' | 'data' | 'personal';
		};
		CompositeTypes: Record<string, never>;
	};
};

export type DiseaseKey = Database['public']['Enums']['disease_key'];
export type GamePhase = Database['public']['Enums']['game_phase'];
export type GameStatus = Database['public']['Enums']['game_status'];
export type PlayerRole = Database['public']['Enums']['player_role'];
export type ResourceKind = Database['public']['Enums']['resource_kind'];

export type GameRow = Database['public']['Tables']['games']['Row'];
export type PlayerRow = Database['public']['Tables']['players']['Row'];
export type DiseaseRow = Database['public']['Tables']['diseases']['Row'];
export type GameCityRow = Database['public']['Tables']['game_cities']['Row'];
export type MapRow = Database['public']['Tables']['maps']['Row'];
export type CrisisCardRow = Database['public']['Tables']['crisis_cards']['Row'];
export type CrisisDrawRow = Database['public']['Tables']['crisis_draws']['Row'];
export type EventLogRow = Database['public']['Tables']['events_log']['Row'];
export type ResourceRow = Database['public']['Tables']['resources']['Row'];
export type RoundRow = Database['public']['Tables']['rounds']['Row'];

export type MapPayload = {
	cities: Array<{
		id: string;
		name: string;
		x: number;
		y: number;
		color: DiseaseKey;
		station?: boolean;
	}>;
	edges: Array<[string, string]>;
};
