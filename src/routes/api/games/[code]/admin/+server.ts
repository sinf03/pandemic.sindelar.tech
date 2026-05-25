import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin, readBody } from '$lib/server/auth';
import { getAdminSupabase } from '$lib/supabase/admin';
import { loadDbState, applyEngineResult } from '$lib/engine/persistence';
import { applyInfection, advanceCure } from '$lib/engine/engine';
import { seededRng } from '$lib/engine/rng';
import { pick } from '$lib/engine/rng';
import { ALL_DISEASES } from '$lib/engine/types';
import type { DiseaseKey, GameStatus, PlayerRole } from '$lib/supabase/types';

type StationKey = 'lab' | 'centrala' | 'sklad' | 'pole' | 'karantena';

type Body =
	| { device_token: string; action: 'set_status'; status: Extract<GameStatus, 'paused' | 'active' | 'finished'>; finish_reason?: string }
	| { device_token: string; action: 'set_role'; player_id: string; role: PlayerRole | null }
	| { device_token: string; action: 'infect_random' }
	| { device_token: string; action: 'heal_player'; player_id: string; disease: DiseaseKey; amount?: number }
	| { device_token: string; action: 'set_city_infection'; city_key: string; disease: DiseaseKey; stage: number }
	| {
			device_token: string;
			action: 'station_complete';
			station: StationKey;
			disease?: DiseaseKey;
			player_id?: string;
			task_label?: string;
	  };

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
		case 'set_city_infection': {
			const stage = Math.max(0, Math.min(3, Math.round(body.stage ?? 0)));
			if (!ALL_DISEASES.includes(body.disease)) throw error(400, 'Neznámá nemoc.');
			const { data: city, error: cErr } = await supabase
				.from('game_cities')
				.select('id, map_city_key, name, infection_levels')
				.eq('game_id', game.id)
				.eq('map_city_key', body.city_key)
				.maybeSingle();
			if (cErr) throw error(500, cErr.message);
			if (!city) throw error(404, 'Město nenalezeno.');
			const current =
				typeof city.infection_levels === 'object' && city.infection_levels
					? (city.infection_levels as Record<string, number>)
					: {};
			const before = current[body.disease] ?? 0;
			const next = { ...current, [body.disease]: stage };
			const { error: uErr } = await supabase
				.from('game_cities')
				.update({ infection_levels: next })
				.eq('id', city.id);
			if (uErr) throw error(500, uErr.message);
			await supabase.from('events_log').insert({
				game_id: game.id,
				kind: 'manual_set_infection',
				payload: {
					city_key: city.map_city_key,
					city_name: city.name,
					disease: body.disease,
					before,
					new_stage: stage
				}
			});
			return json({ ok: true, new_stage: stage });
		}
		case 'station_complete': {
			const { state } = await loadDbState(supabase, code);
			if (state.game.status !== 'active') throw error(409, 'Hra není aktivní.');

			const STATION_TO_DISEASE: Record<Exclude<StationKey, 'karantena'>, DiseaseKey> = {
				lab: 'rubra',
				centrala: 'viridis',
				sklad: 'nox',
				pole: 'aurum'
			};

			if (body.station === 'karantena') {
				if (!body.player_id) throw error(400, 'Karanténa potřebuje hráče.');
				if (!body.disease) throw error(400, 'Karanténa potřebuje nemoc.');
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
				const next = Math.max(0, before - 1);
				const { error: uErr } = await supabase
					.from('players')
					.update({ infection_levels: { ...current, [body.disease]: next } })
					.eq('id', pl.id);
				if (uErr) throw error(500, uErr.message);
				await supabase.from('events_log').insert({
					game_id: game.id,
					kind: 'station_complete',
					payload: {
						station: 'karantena',
						player_id: pl.id,
						player_name: pl.display_name,
						disease: body.disease,
						before,
						new_stage: next,
						task_label: body.task_label ?? null
					}
				});
				return json({ ok: true, station: 'karantena', new_stage: next });
			}

			const station = body.station;
			if (!(station in STATION_TO_DISEASE)) throw error(400, 'Neznámá stanice.');
			const disease = STATION_TO_DISEASE[station as Exclude<StationKey, 'karantena'>];
			const d = state.diseases.find((x) => x.key === disease);
			if (!d) throw error(404, 'Nemoc nenalezena.');
			if (d.cured) {
				return json({
					ok: false,
					already_cured: true,
					message: 'Lék pro tuto nemoc je už hotov.'
				});
			}
			const result = advanceCure(state, disease);
			await applyEngineResult(supabase, state, result);
			await supabase.from('events_log').insert({
				game_id: game.id,
				kind: 'station_complete',
				payload: {
					station,
					disease,
					task_label: body.task_label ?? null,
					new_stage: result.state.diseases.find((x) => x.key === disease)?.cure_stage ?? null
				}
			});
			return json({
				ok: true,
				station,
				disease,
				new_stage: result.state.diseases.find((x) => x.key === disease)?.cure_stage ?? null
			});
		}
		default:
			throw error(400, 'Neznámá admin akce.');
	}
};
