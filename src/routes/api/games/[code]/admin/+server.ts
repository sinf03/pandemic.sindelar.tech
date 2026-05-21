import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin, readBody } from '$lib/server/auth';
import { getAdminSupabase } from '$lib/supabase/admin';
import { loadDbState, applyEngineResult } from '$lib/engine/persistence';
import { applyInfection } from '$lib/engine/engine';
import { seededRng } from '$lib/engine/rng';
import { pick } from '$lib/engine/rng';
import type { DiseaseKey, GameStatus, PlayerRole } from '$lib/supabase/types';

type Body =
	| { device_token: string; action: 'set_status'; status: Extract<GameStatus, 'paused' | 'active' | 'finished'>; finish_reason?: string }
	| { device_token: string; action: 'set_role'; player_id: string; role: PlayerRole | null }
	| { device_token: string; action: 'infect_random' }
	| { device_token: string; action: 'heal_player'; player_id: string; disease: DiseaseKey; amount?: number };

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
			const { state } = await loadDbState(supabase, code);
			const eligible = state.cities.filter((c) => !c.removed && !c.in_quarantine);
			if (eligible.length === 0) throw error(409, 'Žádná města.');
			const rng = seededRng(Date.now());
			const target = pick(eligible, rng);
			const allDiseases: DiseaseKey[] = ['rubra', 'viridis', 'nox', 'aurum'];
			const disease = allDiseases[Math.floor(Math.random() * allDiseases.length)];
			const result = applyInfection(state, target.key, disease, rng);
			await applyEngineResult(supabase, state, result);

			// Log the operator-initiated trigger in addition to the engine events,
			// so the projector feed shows it was a manual nudge.
			await supabase.from('events_log').insert({
				game_id: game.id,
				kind: 'manual_infect',
				payload: {
					city_key: target.key,
					disease,
					new_stage: result.state.cities.find((c) => c.key === target.key)?.infection_levels[disease] ?? 0
				}
			});
			return json({ ok: true, city_key: target.key, disease });
		}
		case 'heal_player': {
			const amount = Math.max(1, Math.min(3, body.amount ?? 1));
			const { data: pl, error: pErr } = await supabase
				.from('players')
				.select('*')
				.eq('id', body.player_id)
				.eq('game_id', game.id)
				.maybeSingle();
			if (pErr) throw error(500, pErr.message);
			if (!pl) throw error(404, 'Hráč nenalezen.');
			const current =
				typeof pl.infection_levels === 'object' && pl.infection_levels
					? (pl.infection_levels as Record<string, number>)
					: {};
			const before = current[body.disease] ?? 0;
			const next = Math.max(0, before - amount);
			const { error: uErr } = await supabase
				.from('players')
				.update({ infection_levels: { ...current, [body.disease]: next } })
				.eq('id', pl.id);
			if (uErr) throw error(500, uErr.message);
			await supabase.from('events_log').insert({
				game_id: game.id,
				kind: 'player_heal',
				payload: {
					player_id: pl.id,
					player_name: pl.display_name,
					disease: body.disease,
					before,
					new_stage: next
				}
			});
			return json({ ok: true, new_stage: next });
		}
		default:
			throw error(400, 'Neznámá admin akce.');
	}
};
