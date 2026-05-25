import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin, readBody } from '$lib/server/auth';
import { loadDbState, applyEngineResult } from '$lib/engine/persistence';
import { applyCrisisEffects, type CrisisEffect } from '$lib/engine/effects';
import { seededRng } from '$lib/engine/rng';
import { getAdminSupabase } from '$lib/supabase/admin';
import type { DiseaseKey } from '$lib/supabase/types';

type Body = {
	device_token: string;
	draw_id: string;
	option_key: string;
	chosen_player_id?: string;
	chosen_city_key?: string;
	chosen_disease?: DiseaseKey;
};

export const POST: RequestHandler = async (event) => {
	const body = await readBody<Body>(event);
	const supabase = getAdminSupabase();
	const { state } = await loadDbState(supabase, event.params.code!);
	await requireAdmin(supabase, state.game.id, body.device_token);

	if (state.game.status !== 'active') throw error(409, 'Hra není aktivní.');

	const { data: draw, error: dErr } = await supabase
		.from('crisis_draws')
		.select('*, card:crisis_cards(*)')
		.eq('id', body.draw_id)
		.eq('game_id', state.game.id)
		.maybeSingle();
	if (dErr) throw error(500, dErr.message);
	if (!draw) throw error(404, 'Krizová karta nenalezena.');
	if (draw.applied_at) throw error(409, 'Tato karta už byla vyřešena.');

	const card = draw.card as unknown as
		| { title: string; options: Array<{ key: string; label: string; reason?: string; effects: CrisisEffect[] }> }
		| null;
	if (!card) throw error(500, 'Krizová karta postrádá data.');
	const option = card.options.find((o) => o.key === body.option_key);
	if (!option) throw error(400, 'Neplatná volba.');

	const rng = seededRng(seedFor(draw.id, body.option_key));
	const result = applyCrisisEffects(state, option.effects ?? [], {
		rng,
		chosen_player_id: body.chosen_player_id,
		chosen_city_key: body.chosen_city_key,
		chosen_disease: body.chosen_disease
	});

	await applyEngineResult(supabase, state, result);
	await supabase
		.from('crisis_draws')
		.update({ chosen_option: body.option_key, applied_at: new Date().toISOString() })
		.eq('id', draw.id);

	const chosenPlayerName = body.chosen_player_id
		? state.players.find((p) => p.id === body.chosen_player_id)?.display_name ?? null
		: null;
	const chosenCityName = body.chosen_city_key
		? state.cities.find((c) => c.key === body.chosen_city_key)?.name ?? null
		: null;
	const reasonParts: string[] = [];
	reasonParts.push(`${card.title} → ${option.label}`);
	if (option.reason) reasonParts.push(option.reason);
	const targetBits: string[] = [];
	if (chosenPlayerName) targetBits.push(`hráč ${chosenPlayerName}`);
	if (chosenCityName) targetBits.push(`město ${chosenCityName}`);
	if (body.chosen_disease) targetBits.push(`nemoc ${body.chosen_disease}`);
	if (targetBits.length > 0) reasonParts.push(`(${targetBits.join(', ')})`);
	const reason = reasonParts.join(' · ');

	await supabase.from('events_log').insert({
		game_id: state.game.id,
		kind: 'crisis_resolved',
		payload: {
			draw_id: draw.id,
			option_key: body.option_key,
			card_title: card.title,
			option_label: option.label,
			reason
		}
	});

	return json({ ok: true, events: result.events });
};

function seedFor(drawId: string, optionKey: string): number {
	let h = 0;
	const s = `${drawId}:${optionKey}`;
	for (let i = 0; i < s.length; i++) {
		h = (h * 31 + s.charCodeAt(i)) >>> 0;
	}
	return h || 1;
}
