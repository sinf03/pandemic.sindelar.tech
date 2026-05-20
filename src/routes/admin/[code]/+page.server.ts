import { loadGameByCode } from '$lib/game/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	return { initial: await loadGameByCode(locals.supabase, params.code) };
};
