/**
 * Player identity for the hybrid game lives in localStorage.
 *
 * Players don't authenticate with Supabase — when they join a game, the
 * `claim_player_slot` RPC returns a `device_token` which we persist here.
 * On future page loads we look it up to restore the player's slot.
 */
import { browser } from '$app/environment';

const KEY_PREFIX = 'pandemic.session.';

export type PlayerSession = {
	game_id: string;
	game_code: string;
	player_id: string;
	device_token: string;
	display_name: string;
	is_admin: boolean;
};

function key(code: string) {
	return KEY_PREFIX + code.toUpperCase();
}

export function saveSession(s: PlayerSession) {
	if (!browser) return;
	localStorage.setItem(key(s.game_code), JSON.stringify(s));
}

export function loadSession(code: string): PlayerSession | null {
	if (!browser) return null;
	const raw = localStorage.getItem(key(code));
	if (!raw) return null;
	try {
		return JSON.parse(raw) as PlayerSession;
	} catch {
		return null;
	}
}

export function clearSession(code: string) {
	if (!browser) return;
	localStorage.removeItem(key(code));
}

/** Most-recently-joined game, useful for landing page "continue" UX. */
export function listSessions(): PlayerSession[] {
	if (!browser) return [];
	const out: PlayerSession[] = [];
	for (let i = 0; i < localStorage.length; i++) {
		const k = localStorage.key(i);
		if (!k || !k.startsWith(KEY_PREFIX)) continue;
		const raw = localStorage.getItem(k);
		if (!raw) continue;
		try {
			out.push(JSON.parse(raw) as PlayerSession);
		} catch {
			// ignore malformed entries
		}
	}
	return out;
}
