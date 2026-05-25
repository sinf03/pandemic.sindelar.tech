import type { DiseaseKey, GamePhase, Json } from '$lib/supabase/types';
import { DISEASE_THEMES, PHASE_LABELS, type DiseaseTheme } from './constants';

export type FormatCtx = {
	theme?: DiseaseTheme;
	cityName?: (key: string) => string | undefined;
	playerName?: (id: string) => string | undefined;
};

function isObj(x: unknown): x is Record<string, unknown> {
	return typeof x === 'object' && x !== null;
}

function diseaseLabel(key: unknown, theme: DiseaseTheme = 'clinical'): string {
	if (typeof key !== 'string') return 'nemoc';
	const map = DISEASE_THEMES[theme] as Record<string, string>;
	return map[key] ?? key;
}

function phaseLabel(p: unknown): string {
	if (typeof p === 'string' && p in PHASE_LABELS) return PHASE_LABELS[p as GamePhase];
	return typeof p === 'string' ? p : '—';
}

function cityLabel(key: unknown, ctx: FormatCtx): string {
	if (typeof key !== 'string') return 'město';
	return ctx.cityName?.(key) ?? key;
}

function playerLabel(id: unknown, payload: Record<string, unknown>, ctx: FormatCtx): string {
	const name = payload.player_name;
	if (typeof name === 'string' && name.length > 0) return name;
	if (typeof id === 'string') return ctx.playerName?.(id) ?? 'hráč';
	return 'hráč';
}

/**
 * Czech-language sentence for an event_log row. Returns a single readable line.
 */
export function formatEvent(kind: string, payload: Json, ctx: FormatCtx = {}): string {
	const p = isObj(payload) ? payload : {};
	const theme = ctx.theme ?? 'clinical';

	switch (kind) {
		case 'game_created': {
			const code = typeof p.code === 'string' ? p.code : '';
			const by = typeof p.by === 'string' ? p.by : '';
			if (by && code) return `Hra ${code} vytvořena vedoucím ${by}`;
			if (code) return `Hra ${code} vytvořena`;
			return 'Hra vytvořena';
		}
		case 'player_join': {
			const name = typeof p.name === 'string' ? p.name : 'hráč';
			const slot = typeof p.slot === 'number' ? p.slot : null;
			return slot !== null ? `Hráč ${name} se připojil (#${slot})` : `Hráč ${name} se připojil`;
		}
		case 'player_leave': {
			const name = typeof p.name === 'string' ? p.name : 'hráč';
			return `Hráč ${name} se odpojil`;
		}
		case 'phase_start': {
			const round = typeof p.round === 'number' ? p.round : null;
			const phase = phaseLabel(p.phase);
			if (round === 1 && p.phase === 'porada') return 'Hra začala — fáze Porada';
			return round !== null
				? `Začalo kolo ${round} — fáze ${phase}`
				: `Začala fáze ${phase}`;
		}
		case 'infection': {
			const stage = typeof p.new_stage === 'number' ? p.new_stage : '?';
			return `Nákaza: ${cityLabel(p.city_key, ctx)} (${diseaseLabel(p.disease, theme)}, stupeň ${stage})`;
		}
		case 'pandemic': {
			const chain = typeof p.chain_depth === 'number' ? p.chain_depth : 0;
			const suffix = chain > 0 ? ` · řetězec ×${chain}` : '';
			return `Pandemie v ${cityLabel(p.city_key, ctx)} (${diseaseLabel(p.disease, theme)})${suffix}`;
		}
		case 'manual_infect': {
			const stage = typeof p.new_stage === 'number' ? p.new_stage : '?';
			return `Ruční nákaza: ${cityLabel(p.city_key, ctx)} (${diseaseLabel(p.disease, theme)}, stupeň ${stage})`;
		}
		case 'cure_step': {
			const stage = typeof p.new_stage === 'number' ? p.new_stage : '?';
			return `Postup léku: ${diseaseLabel(p.disease, theme)} — ${stage}/4`;
		}
		case 'cure_done':
			return `Lék hotov: ${diseaseLabel(p.disease, theme)}`;
		case 'disease_eradicated':
			return `Nemoc vymýcena: ${diseaseLabel(p.disease, theme)}`;
		case 'player_infect': {
			const stage = typeof p.new_stage === 'number' ? p.new_stage : '?';
			return `${playerLabel(p.player_id, p, ctx)} nakažen — ${diseaseLabel(p.disease, theme)} (stupeň ${stage})`;
		}
		case 'player_heal': {
			const stage = typeof p.new_stage === 'number' ? p.new_stage : 0;
			return `${playerLabel(p.player_id, p, ctx)} vyléčen — ${diseaseLabel(p.disease, theme)} (stupeň ${stage})`;
		}
		case 'outcome': {
			const reason = typeof p.reason === 'string' ? p.reason : '';
			const head = p.outcome === 'win' ? 'Hra skončila — vítězství' : 'Hra skončila — prohra';
			return reason ? `${head}: ${reason}` : head;
		}
		case 'crisis_drawn':
			return 'Vylosována krizová karta';
		case 'crisis_resolved': {
			const reason = typeof p.reason === 'string' ? p.reason : '';
			return reason ? `Krize vyřešena — ${reason}` : 'Krize vyřešena';
		}
		case 'manual_set_infection': {
			const stage = typeof p.new_stage === 'number' ? p.new_stage : '?';
			const city = typeof p.city_name === 'string' ? p.city_name : cityLabel(p.city_key, ctx);
			return `Ruční úprava nákazy: ${city} (${diseaseLabel(p.disease, theme)}, stupeň ${stage})`;
		}
		case 'station_complete': {
			const label = typeof p.task_label === 'string' && p.task_label.length > 0 ? p.task_label : null;
			const station = typeof p.station === 'string' ? p.station : '';
			const stationNames: Record<string, string> = {
				lab: 'Laboratoř',
				centrala: 'Centrála',
				sklad: 'Sklad',
				pole: 'Pole',
				karantena: 'Karanténní stanice'
			};
			const stName = stationNames[station] ?? station;
			if (station === 'karantena') {
				const stage = typeof p.new_stage === 'number' ? p.new_stage : '?';
				return label
					? `${stName} — ${playerLabel(p.player_id, p, ctx)} splnil „${label}" → ${diseaseLabel(p.disease, theme)} stupeň ${stage}`
					: `${stName} — ${playerLabel(p.player_id, p, ctx)} se vyléčil o stupeň (${diseaseLabel(p.disease, theme)})`;
			}
			const stage = typeof p.new_stage === 'number' ? p.new_stage : '?';
			return label
				? `${stName} — splněno „${label}" → ${diseaseLabel(p.disease, theme)} ${stage}/4`
				: `${stName} — splněn úkol → ${diseaseLabel(p.disease, theme)} ${stage}/4`;
		}
		case 'crisis_vote': {
			const opt = typeof p.option_key === 'string' ? p.option_key : '?';
			return `${playerLabel(p.player_id, p, ctx)} hlasuje pro: ${opt}`;
		}
		case 'sos':
			return `SOS — ${playerLabel(p.player_id, p, ctx)} potřebuje pomoc`;
		case 'pickup':
			return `${playerLabel(p.player_id, p, ctx)} sebral zdroj`;
		case 'drop':
			return `${playerLabel(p.player_id, p, ctx)} odložil zdroj`;
		case 'station_action':
			return `${playerLabel(p.player_id, p, ctx)} — akce na stanici`;
		case 'note': {
			const text = typeof p.text === 'string' ? p.text : '';
			return text ? `Poznámka: ${text}` : 'Poznámka';
		}
		default:
			return kind;
	}
}

/**
 * Translate a finish_reason (which may be either a code like "manual_admin_end"
 * or already-Czech free text from the engine) into a readable sentence.
 */
export function formatFinishReason(reason: string | null | undefined): string {
	if (!reason) return '—';
	switch (reason) {
		case 'manual_admin_end':
			return 'Hra ukončena vedoucím';
		case 'pandemic_overflow':
			return 'Pandemie překročila limit';
		case 'time_up':
			return 'Vypršel čas — vakcína nestihla';
		case 'all_cured':
			return 'Všechny léky byly vyvinuty';
	}
	return reason;
}
