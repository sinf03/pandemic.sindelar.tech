<script lang="ts">
	import type { PageData } from './$types';
	import { untrack } from 'svelte';
	import { getBrowserSupabase } from '$lib/supabase/client';
	import { formatEvent } from '$lib/game/events';
	import type { DiseaseTheme } from '$lib/game/constants';
	import type {
		GameRow,
		GameCityRow,
		PlayerRow,
		EventLogRow
	} from '$lib/supabase/types';
	import BrandMark from '$lib/components/game/BrandMark.svelte';

	let { data }: { data: PageData } = $props();

	const initial = untrack(() => data.initial);

	let game = $state<GameRow>(initial.game);
	let cities = $state<GameCityRow[]>(initial.cities);
	let players = $state<PlayerRow[]>(initial.players);
	let events = $state<EventLogRow[]>(untrack(() => data.events));

	const theme = $derived.by<DiseaseTheme>(() => {
		const t = (game.settings as { theme?: DiseaseTheme } | null)?.theme;
		return t === 'scout' ? 'scout' : 'clinical';
	});

	const cityNameByKey = $derived.by(() => {
		const m = new Map<string, string>();
		for (const c of cities) m.set(c.map_city_key, c.name);
		return m;
	});
	const playerNameById = $derived.by(() => {
		const m = new Map<string, string>();
		for (const pl of players) m.set(pl.id, pl.display_name);
		return m;
	});
	const eventCtx = $derived({
		theme,
		cityName: (key: string) => cityNameByKey.get(key),
		playerName: (id: string) => playerNameById.get(id)
	});

	function formatTime(iso: string) {
		const d = new Date(iso);
		const hh = d.getHours().toString().padStart(2, '0');
		const mm = d.getMinutes().toString().padStart(2, '0');
		const ss = d.getSeconds().toString().padStart(2, '0');
		return `${hh}:${mm}:${ss}`;
	}

	function severityClass(kind: string) {
		switch (kind) {
			case 'pandemic':
			case 'outcome':
				return 'text-destructive';
			case 'infection':
			case 'manual_infect':
			case 'player_infect':
				return 'text-rubra';
			case 'cure_step':
			case 'cure_done':
			case 'disease_eradicated':
				return 'text-viridis';
			case 'crisis_drawn':
			case 'crisis_resolved':
			case 'crisis_vote':
				return 'text-aurum';
			case 'phase_start':
				return 'text-muted-foreground';
			default:
				return 'text-foreground/90';
		}
	}

	$effect(() => {
		const supabase = getBrowserSupabase();
		const gameId = initial.game.id;

		async function refetchGame() {
			const { data: row } = await supabase
				.from('games')
				.select('*')
				.eq('id', gameId)
				.maybeSingle();
			if (row) game = row;
		}
		async function refetchCities() {
			const { data: rows } = await supabase
				.from('game_cities')
				.select('*')
				.eq('game_id', gameId);
			if (rows) cities = rows;
		}
		async function refetchPlayers() {
			const { data: rows } = await supabase
				.from('players')
				.select('*')
				.eq('game_id', gameId)
				.order('slot_index');
			if (rows) players = rows;
		}

		const channel = supabase
			.channel('events-board:' + gameId)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
				() => {
					refetchGame();
				}
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'game_cities', filter: `game_id=eq.${gameId}` },
				() => {
					refetchCities();
				}
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` },
				() => {
					refetchPlayers();
				}
			)
			.on(
				'postgres_changes',
				{ event: 'INSERT', schema: 'public', table: 'events_log', filter: `game_id=eq.${gameId}` },
				(payload) => {
					const row = payload.new as EventLogRow;
					events = [row, ...events].slice(0, 500);
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	});

	$effect(() => {
		let sentinel: WakeLockSentinel | null = null;
		async function acquire() {
			try {
				const nav = navigator as Navigator & {
					wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinel> };
				};
				if (nav.wakeLock?.request) {
					sentinel = await nav.wakeLock.request('screen');
				}
			} catch {
				// ignore
			}
		}
		acquire();
		return () => {
			sentinel?.release().catch(() => {});
		};
	});
</script>

<svelte:head>
	<title>Události · {game.code}</title>
</svelte:head>

<div class="relative flex h-svh w-svw flex-col overflow-hidden bg-background text-foreground">
	<div
		class="pointer-events-none absolute inset-0 -z-10 opacity-20 [background:radial-gradient(circle_at_1px_1px,theme(colors.foreground/0.12)_1px,transparent_0)] [background-size:32px_32px]"
	></div>

	<header
		class="flex h-20 shrink-0 items-center justify-between gap-6 border-b border-border/50 bg-background/80 px-8 backdrop-blur"
	>
		<div class="flex items-center gap-4">
			<BrandMark size={44} class="rounded-md" />
			<div class="flex flex-col">
				<span class="text-xs uppercase tracking-[0.3em] text-muted-foreground">
					Události · {game.code}
				</span>
				<span class="text-2xl font-semibold tracking-tight">
					{game.name ?? 'Krizový štáb'}
				</span>
			</div>
		</div>
		<div class="flex items-baseline gap-6 text-right">
			<div class="flex flex-col">
				<span class="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Kolo</span>
				<span class="font-mono text-3xl tabular-nums">
					{game.current_round || 0}
				</span>
			</div>
			<div class="flex flex-col">
				<span class="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Záznamů</span>
				<span class="font-mono text-3xl tabular-nums">{events.length}</span>
			</div>
		</div>
	</header>

	<main class="flex min-h-0 flex-1 flex-col overflow-y-auto px-10 py-6">
		{#if events.length === 0}
			<div class="flex flex-1 items-center justify-center text-muted-foreground">
				<span class="text-lg">Zatím žádné události.</span>
			</div>
		{:else}
			<ol class="flex flex-col gap-1">
				{#each events as ev, i (ev.id)}
					<li
						class={[
							'flex items-baseline gap-6 rounded-md px-4 py-3 transition-colors',
							i === 0 ? 'bg-card/60 ring-1 ring-border/60' : 'hover:bg-card/40'
						].join(' ')}
					>
						<span class="w-24 shrink-0 font-mono text-base text-muted-foreground tabular-nums">
							{formatTime(ev.at)}
						</span>
						<span
							class={['flex-1 text-2xl font-medium leading-snug', severityClass(ev.kind)].join(
								' '
							)}
						>
							{formatEvent(ev.kind, ev.payload, eventCtx)}
						</span>
					</li>
				{/each}
			</ol>
		{/if}
	</main>
</div>
