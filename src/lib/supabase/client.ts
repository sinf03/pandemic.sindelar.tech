import { createBrowserClient, isBrowser } from '@supabase/ssr';
import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { Database } from './types';

let _browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Singleton browser-side Supabase client. */
export function getBrowserSupabase() {
	if (!isBrowser()) {
		throw new Error('getBrowserSupabase() called on the server. Use locals.supabase instead.');
	}
	if (!_browserClient) {
		_browserClient = createBrowserClient<Database>(
			PUBLIC_SUPABASE_URL,
			PUBLIC_SUPABASE_PUBLISHABLE_KEY
		);
	}
	return _browserClient;
}
