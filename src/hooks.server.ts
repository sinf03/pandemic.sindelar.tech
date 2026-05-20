import { createSupabaseServerClient } from '$lib/supabase/server';
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

const supabaseHandle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createSupabaseServerClient(event.cookies);

	event.locals.getSession = async () => {
		const {
			data: { user }
		} = await event.locals.supabase.auth.getUser();
		if (!user) return null;
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		return session ?? null;
	};

	return resolve(event, {
		filterSerializedResponseHeaders: (name) => name === 'content-range' || name === 'x-supabase-api-version'
	});
};

export const handle = sequence(supabaseHandle);
