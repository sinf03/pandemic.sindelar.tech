import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requirePlayer, readBody } from '$lib/server/auth';
import { getAdminSupabase } from '$lib/supabase/admin';

type Body = {
	device_token: string;
	kind: string;
	payload?: Record<string, unknown>;
};

const ALLOWED_KINDS = new Set(['sos', 'crisis_vote', 'note', 'pickup', 'drop', 'station_action']);

export const POST: RequestHandler = async (event) => {
	const body = await readBody<Body>(event);
	if (!body.kind || !ALLOWED_KINDS.has(body.kind)) {
		throw error(400, 'Neznámý typ události.');
	}
	const supabase = getAdminSupabase();
	const code = event.params.code!.toUpperCase();
	const { data: game, error: gErr } = await supabase
		.from('games')
		.select('id')
		.eq('code', code)
		.maybeSingle();
	if (gErr) throw error(500, gErr.message);
	if (!game) throw error(404, 'Hra nenalezena.');
	const player = await requirePlayer(supabase, game.id, body.device_token);

	const { error: insErr } = await supabase.from('events_log').insert({
		game_id: game.id,
		kind: body.kind,
		payload: {
			...(body.payload ?? {}),
			player_id: player.id,
			player_name: player.display_name
		}
	});
	if (insErr) throw error(500, insErr.message);
	return json({ ok: true });
};
