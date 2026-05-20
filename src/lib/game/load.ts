import type { SupabaseClient } from '@supabase/supabase-js';
import { error } from '@sveltejs/kit';
import type {
	Database,
	GameRow,
	PlayerRow,
	DiseaseRow,
	GameCityRow,
	MapRow,
	MapPayload
} from '$lib/supabase/types';

export type LoadedGame = {
	game: GameRow;
	players: PlayerRow[];
	cities: GameCityRow[];
	diseases: DiseaseRow[];
	map: MapRow & { payload: MapPayload };
};

export async function loadGameByCode(
	supabase: SupabaseClient<Database>,
	code: string
): Promise<LoadedGame> {
	const upperCode = code.toUpperCase();
	const { data: game, error: gameErr } = await supabase
		.from('games')
		.select('*')
		.eq('code', upperCode)
		.maybeSingle();

	if (gameErr) throw error(500, gameErr.message);
	if (!game) throw error(404, `Hra s kódem ${upperCode} nebyla nalezena.`);

	const [playersRes, citiesRes, diseasesRes, mapRes] = await Promise.all([
		supabase.from('players').select('*').eq('game_id', game.id).order('slot_index'),
		supabase.from('game_cities').select('*').eq('game_id', game.id),
		supabase.from('diseases').select('*').eq('game_id', game.id),
		supabase.from('maps').select('*').eq('id', game.map_id).maybeSingle()
	]);

	if (!mapRes.data) throw error(500, 'Mapa hry nebyla nalezena.');

	return {
		game,
		players: playersRes.data ?? [],
		cities: citiesRes.data ?? [],
		diseases: diseasesRes.data ?? [],
		map: { ...mapRes.data, payload: mapRes.data.payload as MapPayload }
	};
}

export function infectionStage(levels: unknown, key: string): number {
	if (typeof levels !== 'object' || !levels) return 0;
	const v = (levels as Record<string, unknown>)[key];
	if (typeof v !== 'number') return 0;
	return Math.max(0, Math.min(3, Math.round(v)));
}

export function maxInfectionStage(levels: unknown): number {
	if (typeof levels !== 'object' || !levels) return 0;
	let max = 0;
	for (const v of Object.values(levels as Record<string, unknown>)) {
		if (typeof v === 'number' && v > max) max = Math.round(v);
	}
	return Math.max(0, Math.min(3, max));
}
