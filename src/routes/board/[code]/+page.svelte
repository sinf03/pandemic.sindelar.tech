<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import { getBrowserSupabase } from '$lib/supabase/client';
	import { untrack } from 'svelte';
	import { DEFAULT_SETTINGS, DISEASE_KEYS, DISEASE_THEMES, type DiseaseTheme } from '$lib/game/constants';
	import { formatEvent, formatFinishReason } from '$lib/game/events';
	import type {
		GameRow,
		PlayerRow,
		DiseaseRow,
		GameCityRow,
		EventLogRow,
		DiseaseKey
	} from '$lib/supabase/types';
	import MapCanvas from '$lib/components/game/MapCanvas.svelte';
	import PhaseTimer from '$lib/components/game/PhaseTimer.svelte';
	import BrandMark from '$lib/components/game/BrandMark.svelte';

	let { data }: { data: PageData } = $props();

	const initial = untrack(() => data.initial);

	let game = $state<GameRow>(initial.game);
	let diseases = $state<DiseaseRow[]>(initial.diseases);
	let cities = $state<GameCityRow[]>(initial.cities);
	let players = $state<PlayerRow[]>(initial.players);
	let events = $state<EventLogRow[]>([]);

	const code = $derived((page.params.code ?? '').toUpperCase());

	const settings = $derived(
		(game.settings as Partial<typeof DEFAULT_SETTINGS> | null) ?? DEFAULT_SETTINGS
	);

	const theme = $derived.by<DiseaseTheme>(() => {
		const t = (game.settings as { theme?: DiseaseTheme } | null)?.theme;
		return t === 'scout' ? 'scout' : 'clinical';
	});

	const diseaseLabels = $derived(DISEASE_THEMES[theme]);

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

	const pandemicLoseAt = $derived(settings.pandemic_lose_at ?? 8);
	const totalRounds = $derived(settings.round_count ?? 12);

	const orderedDiseases = $derived.by(() => {
		const out: DiseaseRow[] = [];
		for (const k of DISEASE_KEYS) {
			const d = diseases.find((x) => x.key === k);
			if (d) out.push(d);
		}
		return out;
	});

	const won = $derived(
		game.status === 'finished' && diseases.length > 0 && diseases.every((d) => d.cured)
	);

	function diseaseBg(key: DiseaseKey) {
		return `bg-${key}`;
	}

	function formatTime(iso: string) {
		const d = new Date(iso);
		const hh = d.getHours().toString().padStart(2, '0');
		const mm = d.getMinutes().toString().padStart(2, '0');
		const ss = d.getSeconds().toString().padStart(2, '0');
		return `${hh}:${mm}:${ss}`;
	}

	function openEventsWindow() {
		const url = `/board/${code}/events`;
		const features = 'noopener,noreferrer,width=1200,height=800';
		window.open(url, `pandemic-events-${code}`, features);
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
		async function refetchDiseases() {
			const { data: rows } = await supabase.from('diseases').select('*').eq('game_id', gameId);
			if (rows) diseases = rows;
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
			.channel('board:' + gameId)
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
				{ event: '*', schema: 'public', table: 'diseases', filter: `game_id=eq.${gameId}` },
				() => {
					refetchDiseases();
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
					events = [row, ...events].slice(0, 8);
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	});

	// Wake lock to keep the projector display awake.
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

<div class="relative flex h-svh w-svw flex-col overflow-hidden bg-background text-foreground">
	<div
		class="pointer-events-none absolute inset-0 -z-10 opacity-20 [background:radial-gradient(circle_at_1px_1px,theme(colors.foreground/0.12)_1px,transparent_0)] [background-size:32px_32px]"
	></div>

	<!-- Header strip -->
	<header
		class="flex h-16 shrink-0 items-center justify-between gap-6 border-b border-border/50 bg-background/80 px-6 backdrop-blur"
	>
		<div class="flex min-w-0 items-center gap-3">
			<BrandMark size={40} class="rounded-md" />
			<div class="flex min-w-0 flex-col">
				<span class="truncate text-base font-semibold tracking-tight">
					{game.name ?? 'Krizový štáb'}
				</span>
				<span class="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
					{game.code}
				</span>
			</div>
		</div>
		<span class="text-center text-sm uppercase tracking-[0.4em] text-muted-foreground">
			PANDEMIC · <span class="text-rubra">Krizový štáb</span>
		</span>
		<PhaseTimer phase={game.current_phase} endsAt={game.phase_ends_at} />
	</header>

	<!-- Main area -->
	<main class="flex min-h-0 flex-1">
		<!-- Map (~2/3) -->
		<section class="relative flex min-h-0 flex-1 items-center justify-center p-4">
			<div class="relative h-full w-full">
				<MapCanvas map={initial.map} {cities} />
			</div>
		</section>

		<!-- Right rail (~1/3) -->
		<aside
			class="flex w-[34%] min-w-[360px] flex-col gap-4 border-l border-border/50 bg-card/30 p-6 backdrop-blur"
		>
			<!-- Pandemic counter -->
			<div class="flex flex-col gap-2">
				<div class="flex items-baseline justify-between">
					<span class="text-xs uppercase tracking-[0.25em] text-muted-foreground">
						Pandemie
					</span>
					<span class="font-mono text-xs text-muted-foreground">
						/ {pandemicLoseAt}
					</span>
				</div>
				<div class="flex items-baseline gap-3">
					<span class="font-mono text-6xl font-semibold tabular-nums leading-none text-destructive">
						{game.pandemic_count}
					</span>
					<div class="flex flex-1 flex-col gap-1">
						<div class="h-3 w-full overflow-hidden rounded-full bg-muted/50">
							<div
								class="h-full bg-destructive transition-all"
								style={`width: ${Math.min(100, (game.pandemic_count / pandemicLoseAt) * 100)}%`}
							></div>
						</div>
						<span class="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
							epidemií / {pandemicLoseAt} = prohra
						</span>
					</div>
				</div>
			</div>

			<!-- Cure progress -->
			<div class="flex flex-col gap-3">
				<span class="text-xs uppercase tracking-[0.25em] text-muted-foreground">
					Vývoj léků
				</span>
				<div class="flex flex-col gap-2">
					{#each orderedDiseases as d (d.id)}
						<div class="flex items-center gap-3">
							<span
								class={`size-3 shrink-0 rounded-full ${diseaseBg(d.key)} ${d.cured ? '' : 'opacity-70'}`}
								aria-hidden="true"
							></span>
							<span class="min-w-0 flex-1 truncate text-sm font-medium">
								{d.name}
							</span>
							<div class="flex gap-1" aria-label={`Pokrok ${d.cure_stage} ze 4`}>
								{#each [0, 1, 2, 3] as i (i)}
									<span
										class={[
											'size-3 rounded-sm border border-border/50',
											i < d.cure_stage ? diseaseBg(d.key) : 'bg-background/40'
										].join(' ')}
									></span>
								{/each}
							</div>
							{#if d.cured}
								<span class="text-[10px] uppercase tracking-widest text-viridis">vyléčeno</span>
							{/if}
						</div>
					{/each}
					{#if orderedDiseases.length === 0}
						<span class="text-xs text-muted-foreground">
							Nemoci se objeví po startu hry.
						</span>
					{/if}
				</div>
			</div>

			<!-- Rounds -->
			<div class="mt-auto flex flex-col gap-1">
				<span class="text-xs uppercase tracking-[0.25em] text-muted-foreground">Kolo</span>
				<div class="flex items-baseline gap-2">
					<span class="font-mono text-5xl font-semibold tabular-nums leading-none">
						{game.current_round || 0}
					</span>
					<span class="font-mono text-base text-muted-foreground">/ {totalRounds}</span>
				</div>
			</div>

			<!-- Disease names for legibility -->
			<div class="grid grid-cols-2 gap-2 text-[11px] uppercase tracking-[0.18em]">
				{#each DISEASE_KEYS as k (k)}
					<div class="flex items-center gap-2">
						<span class={`size-2.5 rounded-full ${diseaseBg(k)}`} aria-hidden="true"></span>
						<span class="text-muted-foreground">{diseaseLabels[k]}</span>
					</div>
				{/each}
			</div>
		</aside>
	</main>

	{#if game.status === 'finished'}
		<div
			class="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-sm"
			role="status"
			aria-live="polite"
		>
			<div
				class={[
					'flex flex-col items-center gap-4 rounded-2xl border-2 px-12 py-10 text-center shadow-2xl',
					won
						? 'border-viridis/60 bg-viridis/10 text-viridis'
						: 'border-destructive/60 bg-destructive/10 text-destructive'
				].join(' ')}
			>
				<span class="text-sm uppercase tracking-[0.4em] opacity-80">
					{won ? 'Vítězství' : 'Konec hry'}
				</span>
				<h2 class="text-6xl font-semibold tracking-tight">
					{won ? 'KRIZE ZAŽEHNÁNA' : 'PANDEMIE ZVÍTĚZILA'}
				</h2>
				<p class="max-w-xl text-base text-foreground/80">
					{formatFinishReason(game.finish_reason)}
				</p>
			</div>
		</div>
	{/if}

	<!-- Footer ticker — click to open a dedicated events window for a second projector -->
	<button
		type="button"
		onclick={openEventsWindow}
		title="Otevřít okno událostí pro druhý projektor"
		aria-label="Otevřít okno událostí pro druhý projektor"
		class="group flex h-16 shrink-0 cursor-pointer items-center gap-6 overflow-hidden border-t border-border/50 bg-background/80 px-6 text-left font-mono text-xs backdrop-blur transition-colors hover:bg-background/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
	>
		<span class="shrink-0 uppercase tracking-[0.3em] text-muted-foreground group-hover:text-foreground">
			Události →
		</span>
		<div class="flex min-w-0 flex-1 items-center gap-6 overflow-hidden">
			{#if events.length === 0}
				<span class="text-muted-foreground/70">
					Zatím žádné události. Klikni pro samostatné okno.
				</span>
			{:else}
				{#each events as ev (ev.id)}
					<span class="flex shrink-0 items-center gap-2 whitespace-nowrap">
						<span class="text-muted-foreground">{formatTime(ev.at)}</span>
						<span class="text-foreground/90">{formatEvent(ev.kind, ev.payload, eventCtx)}</span>
					</span>
				{/each}
			{/if}
		</div>
	</button>
</div>
