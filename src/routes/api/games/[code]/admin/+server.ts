import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin, readBody } from '$lib/server/auth';
import { getAdminSupabase } from '$lib/supabase/admin';
import type { DiseaseKey, GameStatus, PlayerRole } from '$lib/supabase/types';

type Body =
	| { device_token: string; action: 'set_status'; status: Extract<GameStatus, 'paused' | 'active' | 'finished'>; finish_reason?: string }
	| { device_token: string; action: 'set_role'; player_id: string; role: PlayerRole | null }
	| { device_token: string; action: 'infect_random' };

export const POST: RequestHandler = async (event) => {
	const body = await readBody<Body>(event);
	const supabase = getAdminSupabase();
	const code = event.params.code!.toUpperCase();

	const { data: game, error: gErr } = await supabase
		.from('games')
		.select('id, status')
		.eq('code', code)
		.maybeSingle();
	if (gErr) throw error(500, gErr.message);
	if (!game) throw error(404, 'Hra nenalezena.');
	await requireAdmin(supabase, game.id, body.device_token);

	switch (body.action) {
		case 'set_status': {
			const patch: { status: GameStatus; finish_reason?: string | null; finished_at?: string } = {
				status: body.status
			};
			if (body.status === 'finished') {
				patch.finish_reason = body.finish_reason ?? 'manual_admin_end';
				patch.finished_at = new Date().toISOString();
			}
			const { error: err } = await supabase.from('games').update(patch).eq('id', game.id);
			if (err) throw error(500, err.message);
			return json({ ok: true });
		}
		case 'set_role': {
			const { error: err } = await supabase
				.from('players')
				.update({ role: body.role })
				.eq('id', body.player_id)
				.eq('game_id', game.id);
			if (err) throw error(500, err.message);
			return json({ ok: true });
		}
		case 'infect_random': {
			const { data: cities, error: cErr } = await supabase
				.from('game_cities')
				.select('*')
				.eq('game_id', game.id);
			if (cErr) throw error(500, cErr.message);
			if (!cities || cities.length === 0) throw error(409, 'Žádná města.');
			const city = cities[Math.floor(Math.random() * cities.length)];
			const all: DiseaseKey[] = ['rubra', 'viridis', 'nox', 'aurum'];
			const disease = all[Math.floor(Math.random() * all.length)];
			const current =
				typeof city.infection_levels === 'object' && city.infection_levels
					? (city.infection_levels as Record<string, number>)
					: {};
			const next = Math.min(3, (current[disease] ?? 0) + 1);
			const { error: uErr } = await supabase
				.from('game_cities')
				.update({ infection_levels: { ...current, [disease]: next } })
				.eq('id', city.id);
			if (uErr) throw error(500, uErr.message);
			await supabase.from('events_log').insert({
				game_id: game.id,
				kind: 'manual_infect',
				payload: { city_key: city.map_city_key, disease, new_stage: next }
			});
			return json({ ok: true, city_key: city.map_city_key, disease, new_stage: next });
		}
		default:
			throw error(400, 'Neznámá admin akce.');
	}
};
