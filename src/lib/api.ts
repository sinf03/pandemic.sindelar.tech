/**
 * Client-side wrappers for `/api/games/[code]/...` mutation endpoints. Every
 * call automatically pulls the player's device_token from the stored session.
 */
import { loadSession } from './session';

export class GameApiError extends Error {
	status: number;
	constructor(message: string, status: number) {
		super(message);
		this.status = status;
	}
}

async function call(code: string, path: string, body: Record<string, unknown> = {}) {
	const session = loadSession(code);
	if (!session) throw new GameApiError('Není uložena relace pro tuto hru.', 401);
	const res = await fetch(`/api/games/${code.toUpperCase()}/${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ device_token: session.device_token, ...body })
	});
	const contentType = res.headers.get('content-type') ?? '';
	const parsed = contentType.includes('application/json')
		? ((await res.json()) as unknown)
		: await res.text();
	if (!res.ok) {
		const msg =
			(typeof parsed === 'object' && parsed && 'message' in parsed
				? String((parsed as { message: unknown }).message)
				: typeof parsed === 'string'
					? parsed
					: `HTTP ${res.status}`) || `HTTP ${res.status}`;
		throw new GameApiError(msg, res.status);
	}
	return parsed as Record<string, unknown>;
}

export const gameApi = {
	start: (code: string) => call(code, 'start'),
	advancePhase: (code: string) => call(code, 'advance-phase'),
	advanceCure: (code: string, disease: string, direction: 'advance' | 'rollback' = 'advance') =>
		call(code, 'cure', { disease, direction }),
	drawCrisis: (code: string, cardId?: string) => call(code, 'crisis/draw', cardId ? { card_id: cardId } : {}),
	resolveCrisis: (
		code: string,
		args: {
			draw_id: string;
			option_key: string;
			chosen_player_id?: string;
			chosen_city_key?: string;
			chosen_disease?: string;
		}
	) => call(code, 'crisis/resolve', args),
	setStatus: (code: string, status: 'paused' | 'active' | 'finished', finish_reason?: string) =>
		call(code, 'admin', { action: 'set_status', status, finish_reason }),
	setRole: (code: string, player_id: string, role: string | null) =>
		call(code, 'admin', { action: 'set_role', player_id, role }),
	infectRandom: (code: string) => call(code, 'admin', { action: 'infect_random' }),
	logEvent: (code: string, kind: string, payload: Record<string, unknown> = {}) =>
		call(code, 'event', { kind, payload })
};

/**
 * Recover a player session on a fresh device using only a device_token.
 * Doesn't go through `call()` because there's no local session yet.
 */
export async function whoami(
	code: string,
	deviceToken: string
): Promise<{
	game_id: string;
	game_code: string;
	player_id: string;
	device_token: string;
	display_name: string;
	is_admin: boolean;
}> {
	const res = await fetch(`/api/games/${code.toUpperCase()}/whoami`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ device_token: deviceToken })
	});
	if (!res.ok) {
		const text = await res.text();
		throw new GameApiError(text || `HTTP ${res.status}`, res.status);
	}
	return res.json();
}
