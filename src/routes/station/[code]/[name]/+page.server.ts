import { error } from '@sveltejs/kit';
import { loadGameByCode } from '$lib/game/load';
import { STATIONS, isStationKey } from '$lib/stations';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!isStationKey(params.name)) {
		throw error(404, `Stanice ${params.name} neexistuje.`);
	}
	const initial = await loadGameByCode(locals.supabase, params.code);
	return {
		initial,
		station: STATIONS[params.name]
	};
};
