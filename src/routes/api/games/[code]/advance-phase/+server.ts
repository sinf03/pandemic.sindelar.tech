import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin, readBody } from '$lib/server/auth';
import { loadDbState, applyEngineResult } from '$lib/engine/persistence';
import { advancePhase } from '$lib/engine';
import { seededRng } from '$lib/engine/rng';
import { getAdminSupabase } from '$lib/supabase/admin';

type Body = { device_token: string };

export const POST: RequestHandler = async (event) => {
	const body = await readBody<Body>(event);
	const supabase = getAdminSupabase();
	const { state } = await loadDbState(supabase, event.params.code!);
	await requireAdmin(supabase, state.game.id, body.device_token);

	if (state.game.status !== 'active') {
		throw error(409, 'Hra není aktivní.');
	}

	const rng = seededRng(seedFor(state.game.id, state.game.current_round, state.game.current_phase));
	const result = advancePhase(state, { now: new Date(), rng });
	await applyEngineResult(supabase, state, result);
	return json({ ok: true, events: result.events, game: result.state.game });
};

function seedFor(gameId: string, round: number, phase: string | null): number {
	let h = 0;
	const s = `${gameId}:${round}:${phase ?? ''}`;
	for (let i = 0; i < s.length; i++) {
		h = (h * 31 + s.charCodeAt(i)) >>> 0;
	}
	return h || 1;
}
