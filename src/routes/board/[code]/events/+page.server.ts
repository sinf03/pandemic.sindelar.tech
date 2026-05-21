import { error } from '@sveltejs/kit';
import { loadGameByCode } from '$lib/game/load';
import type { EventLogRow } from '$lib/supabase/types';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 200;

export const load: PageServerLoad = async ({ params, locals }) => {
	const loaded = await loadGameByCode(locals.supabase, params.code);

	const { data: events, error: evErr } = await locals.supabase
		.from('events_log')
		.select('*')
		.eq('game_id', loaded.game.id)
		.order('at', { ascending: false })
		.limit(PAGE_SIZE);

	if (evErr) throw error(500, evErr.message);

	return {
		initial: loaded,
		events: (events ?? []) as EventLogRow[]
	};
};
