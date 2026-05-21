import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requirePlayer, readBody } from '$lib/server/auth';
import { loadDbState, applyEngineResult } from '$lib/engine/persistence';
import { advanceCure, rollbackCure } from '$lib/engine';
import { getAdminSupabase } from '$lib/supabase/admin';
import type { DiseaseKey } from '$lib/supabase/types';

type Body = {
	device_token: string;
	disease: DiseaseKey;
	direction?: 'advance' | 'rollback';
	phases?: number;
};

export const POST: RequestHandler = async (event) => {
	const body = await readBody<Body>(event);
	const supabase = getAdminSupabase();
	const { state } = await loadDbState(supabase, event.params.code!);
	const player = await requirePlayer(supabase, state.game.id, body.device_token);

	if (state.game.status !== 'active') {
		throw error(409, 'Hra není aktivní.');
	}
	if (!body.disease || !state.diseases.find((d) => d.key === body.disease)) {
		throw error(400, 'Neznámá nemoc.');
	}

	const direction = body.direction ?? 'advance';
	const phases = Math.max(1, Math.min(4, body.phases ?? 1));

	// Only the leader can roll back cures. Anyone can advance their team's cure.
	if (direction === 'rollback' && !player.is_admin) {
		throw error(403, 'Pouze vedoucí může vrátit fázi léku.');
	}

	let result;
	if (direction === 'rollback') {
		result = rollbackCure(state, body.disease, phases);
	} else {
		let s = state;
		const events = [];
		for (let i = 0; i < phases; i++) {
			const r = advanceCure(s, body.disease);
			s = r.state;
			events.push(...r.events);
		}
		result = { state: s, events };
	}
	await applyEngineResult(supabase, state, result);
	return json({ ok: true, events: result.events });
};
