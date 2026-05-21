import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin, readBody } from '$lib/server/auth';
import { loadDbState } from '$lib/engine/persistence';
import { getAdminSupabase } from '$lib/supabase/admin';

type Body = { device_token: string; card_id?: string };

export const POST: RequestHandler = async (event) => {
	const body = await readBody<Body>(event);
	const supabase = getAdminSupabase();
	const { state } = await loadDbState(supabase, event.params.code!);
	await requireAdmin(supabase, state.game.id, body.device_token);

	if (state.game.status !== 'active') {
		throw error(409, 'Hra není aktivní.');
	}

	let cardId = body.card_id;
	if (!cardId) {
		const { data: cards, error: err } = await supabase
			.from('crisis_cards')
			.select('id')
			.eq('is_active', true);
		if (err) throw error(500, err.message);
		if (!cards || cards.length === 0) throw error(500, 'Žádné krizové karty nejsou aktivní.');
		// avoid recently-drawn cards if possible
		const { data: recent } = await supabase
			.from('crisis_draws')
			.select('card_id')
			.eq('game_id', state.game.id)
			.order('drawn_at', { ascending: false })
			.limit(3);
		const recentIds = new Set((recent ?? []).map((r) => r.card_id));
		const pool = cards.filter((c) => !recentIds.has(c.id));
		const finalPool = pool.length > 0 ? pool : cards;
		cardId = finalPool[Math.floor(Math.random() * finalPool.length)].id;
	}

	const { data: draw, error: insErr } = await supabase
		.from('crisis_draws')
		.insert({
			game_id: state.game.id,
			card_id: cardId
		})
		.select('*, card:crisis_cards(*)')
		.single();
	if (insErr) throw error(500, insErr.message);

	// emit an events_log row so the projector ticker shows it
	await supabase.from('events_log').insert({
		game_id: state.game.id,
		kind: 'crisis_drawn',
		payload: { draw_id: draw.id, card_id: cardId }
	});

	return json({ ok: true, draw });
};
