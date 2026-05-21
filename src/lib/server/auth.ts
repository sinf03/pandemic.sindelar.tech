/**
 * Players don't have Supabase auth sessions — they identify by device_token.
 * Server-side mutation endpoints accept that token in the request body and
 * verify it matches a player row in the given game.
 */
import { error, type RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, PlayerRow } from '$lib/supabase/types';

export type AuthedPlayer = PlayerRow;

export async function readBody<T>(event: RequestEvent): Promise<T> {
	try {
		return (await event.request.json()) as T;
	} catch {
		throw error(400, 'Invalid JSON body.');
	}
}

export async function requirePlayer(
	supabase: SupabaseClient<Database>,
	gameId: string,
	deviceToken: string | undefined | null
): Promise<AuthedPlayer> {
	if (!deviceToken) throw error(401, 'Missing device_token.');
	const { data: player, error: err } = await supabase
		.from('players')
		.select('*')
		.eq('game_id', gameId)
		.eq('device_token', deviceToken)
		.maybeSingle();
	if (err) throw error(500, err.message);
	if (!player) throw error(403, 'Tato relace nepatří do této hry.');
	return player;
}

export async function requireAdmin(
	supabase: SupabaseClient<Database>,
	gameId: string,
	deviceToken: string | undefined | null
): Promise<AuthedPlayer> {
	const player = await requirePlayer(supabase, gameId, deviceToken);
	if (!player.is_admin) throw error(403, 'Pouze vedoucí může provést tuto akci.');
	return player;
}
