/**
 * Recover a player session from a device_token.
 *
 * Used by the leader-recovery link flow: the leader copies a URL containing
 * their device_token, opens it on another device, and the admin page calls
 * this endpoint to restore the localStorage session.
 *
 * Verifies the token belongs to a player in the given game and returns the
 * full session shape the client expects.
 */
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readBody, requirePlayer } from '$lib/server/auth';
import { getAdminSupabase } from '$lib/supabase/admin';

type Body = { device_token: string };

export const POST: RequestHandler = async (event) => {
	const body = await readBody<Body>(event);
	const code = event.params.code!.toUpperCase();
	const supabase = getAdminSupabase();

	const { data: game, error: gErr } = await supabase
		.from('games')
		.select('id, code')
		.eq('code', code)
		.maybeSingle();
	if (gErr) throw error(500, gErr.message);
	if (!game) throw error(404, 'Hra nenalezena.');

	const player = await requirePlayer(supabase, game.id, body.device_token);

	return json({
		game_id: game.id,
		game_code: game.code,
		player_id: player.id,
		device_token: player.device_token,
		display_name: player.display_name,
		is_admin: player.is_admin
	});
};
