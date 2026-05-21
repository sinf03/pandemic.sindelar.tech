/**
 * Server-only admin Supabase client. Uses the service-role key so it can
 * bypass RLS for game-state mutations. Authorization for these mutations is
 * enforced at the application layer (see `$lib/server/auth`).
 *
 * NEVER import this from the browser. It must only be referenced from
 * +page.server.ts / +server.ts / hooks.server.ts.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import type { Database } from './types';

let _admin: SupabaseClient<Database> | null = null;

export function getAdminSupabase(): SupabaseClient<Database> {
	if (_admin) return _admin;
	const key = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!key) {
		throw new Error(
			'SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (service role key from Supabase dashboard → Project Settings → API).'
		);
	}
	_admin = createClient<Database>(PUBLIC_SUPABASE_URL, key, {
		auth: { persistSession: false, autoRefreshToken: false }
	});
	return _admin;
}
