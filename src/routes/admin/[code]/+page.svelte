<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import { getBrowserSupabase } from '$lib/supabase/client';
	import { loadSession, type PlayerSession } from '$lib/session';
	import {
		DISEASE_KEYS,
		DISEASE_THEMES,
		DEFAULT_SETTINGS,
		PHASE_LABELS,
		PHASE_ORDER,
		ROLE_LABELS,
		type DiseaseTheme
	} from '$lib/game/constants';
	import type {
		GameRow,
		PlayerRow,
		DiseaseRow,
		GameCityRow,
		PlayerRole,
		GamePhase,
		DiseaseKey
	} from '$lib/supabase/types';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import MapCanvas from '$lib/components/game/MapCanvas.svelte';
	import {
		Copy,
		Check,
		Play,
		Pause,
		Square,
		ChevronRight,
		Shuffle,
		QrCode
	} from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	const initial = untrack(() => data.initial);

	let game = $state<GameRow>(initial.game);
	let players = $state<PlayerRow[]>(initial.players);
	let diseases = $state<DiseaseRow[]>(initial.diseases);
	let cities = $state<GameCityRow[]>(initial.cities);

	let session = $state<PlayerSession | null>(null);
	let sessionChecked = $state(false);
	let copied = $state(false);
	let busy = $state(false);
	let errorMessage = $state<string | null>(null);

	const code = $derived((page.params.code ?? '').toUpperCase());

	$effect(() => {
		const s = loadSession(code);
		if (!s || !s.is_admin) {
			goto('/');
			return;
		}
		session = s;
		sessionChecked = true;
	});

	const joinUrl = $derived(`${page.url.origin}/join?code=${code}`);

	const theme = $derived.by<DiseaseTheme>(() => {
		const t = (game.settings as { theme?: DiseaseTheme } | null)?.theme;
		return t === 'scout' ? 'scout' : 'clinical';
	});

	const settings = $derived(
		(game.settings as Partial<typeof DEFAULT_SETTINGS> | null) ?? DEFAULT_SETTINGS
	);

	const sortedPlayers = $derived([...players].sort((a, b) => a.slot_index - b.slot_index));

	const allRoles: PlayerRole[] = [
		'koordinator',
		'epidemiolog',
		'medik',
		'logistik',
		'vyzkumnik',
		'spojka_a',
		'spojka_b',
		'technik'
	];

	function isConnected(p: PlayerRow) {
		const t = new Date(p.last_seen_at).getTime();
		return Number.isFinite(t) && Date.now() - t < 30_000;
	}

	function statusBadgeVariant(s: GameRow['status']) {
		switch (s) {
			case 'lobby':
				return 'outline';
			case 'active':
				return 'default';
			case 'paused':
				return 'secondary';
			case 'finished':
				return 'destructive';
		}
	}

	function statusLabel(s: GameRow['status']) {
		switch (s) {
			case 'lobby':
				return 'Lobby';
			case 'active':
				return 'Aktivní';
			case 'paused':
				return 'Pauza';
			case 'finished':
				return 'Konec';
		}
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(joinUrl);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 1500);
		} catch {
			// ignore
		}
	}

	async function updatePlayerRole(playerId: string, role: PlayerRole | null) {
		const supabase = getBrowserSupabase();
		await supabase.from('players').update({ role }).eq('id', playerId);
	}

	function nextPhase(p: GamePhase): { phase: GamePhase; wrap: boolean } {
		const idx = PHASE_ORDER.indexOf(p);
		const ni = (idx + 1) % PHASE_ORDER.length;
		return { phase: PHASE_ORDER[ni], wrap: ni === 0 };
	}

	async function advancePhase() {
		if (busy) return;
		busy = true;
		errorMessage = null;
		try {
			const supabase = getBrowserSupabase();
			const current = game.current_phase ?? 'porada';
			const { phase, wrap } = nextPhase(current);
			const phaseSeconds =
				settings.phase_durations_s?.[phase] ?? DEFAULT_SETTINGS.phase_durations_s[phase];
			const ends = new Date(Date.now() + phaseSeconds * 1000).toISOString();
			const patch: Partial<GameRow> = {
				current_phase: phase,
				phase_ends_at: ends
			};
			if (wrap) patch.current_round = (game.current_round || 0) + 1;
			const { error } = await supabase.from('games').update(patch).eq('id', game.id);
			if (error) errorMessage = error.message;
		} finally {
			busy = false;
		}
	}

	async function startGame() {
		if (busy) return;
		busy = true;
		errorMessage = null;
		try {
			const supabase = getBrowserSupabase();
			const themeNames = DISEASE_THEMES[theme];

			// 1. Insert disease rows (idempotent: skip on conflict)
			const diseaseRows = DISEASE_KEYS.map((k) => ({
				game_id: game.id,
				key: k,
				name: themeNames[k],
				color_token: k
			}));
			const { error: diseaseErr } = await supabase
				.from('diseases')
				.upsert(diseaseRows, { onConflict: 'game_id,key' });
			if (diseaseErr) {
				errorMessage = diseaseErr.message;
				return;
			}

			// 2. Build game_cities from map payload
			const cityRows = initial.map.payload.cities.map((c) => ({
				game_id: game.id,
				map_city_key: c.id,
				name: c.name,
				x: c.x,
				y: c.y,
				color_token: c.color,
				has_station: !!c.station,
				infection_levels: {}
			}));
			const { error: cityErr } = await supabase
				.from('game_cities')
				.upsert(cityRows, { onConflict: 'game_id,map_city_key' });
			if (cityErr) {
				errorMessage = cityErr.message;
				return;
			}

			// 3. Update game to active
			const poradaSeconds =
				settings.phase_durations_s?.porada ?? DEFAULT_SETTINGS.phase_durations_s.porada;
			const now = new Date();
			const ends = new Date(now.getTime() + poradaSeconds * 1000).toISOString();
			const { error: gameErr } = await supabase
				.from('games')
				.update({
					status: 'active',
					current_round: 1,
					current_phase: 'porada',
					started_at: now.toISOString(),
					phase_ends_at: ends
				})
				.eq('id', game.id);
			if (gameErr) errorMessage = gameErr.message;
		} finally {
			busy = false;
		}
	}

	async function pauseGame() {
		if (busy) return;
		busy = true;
		try {
			const supabase = getBrowserSupabase();
			await supabase.from('games').update({ status: 'paused' }).eq('id', game.id);
		} finally {
			busy = false;
		}
	}

	async function endGame() {
		if (busy) return;
		busy = true;
		try {
			const supabase = getBrowserSupabase();
			await supabase
				.from('games')
				.update({
					status: 'finished',
					finished_at: new Date().toISOString(),
					finish_reason: 'manual_admin_end'
				})
				.eq('id', game.id);
		} finally {
			busy = false;
		}
	}

	async function infectRandom() {
		if (busy || cities.length === 0) return;
		busy = true;
		try {
			const supabase = getBrowserSupabase();
			const city = cities[Math.floor(Math.random() * cities.length)];
			const diseaseKey = DISEASE_KEYS[Math.floor(Math.random() * DISEASE_KEYS.length)];
			const current =
				typeof city.infection_levels === 'object' && city.infection_levels
					? (city.infection_levels as Record<string, number>)
					: {};
			const nextStage = Math.min(3, (current[diseaseKey] ?? 0) + 1);
			const nextLevels = { ...current, [diseaseKey]: nextStage };
			await supabase
				.from('game_cities')
				.update({ infection_levels: nextLevels })
				.eq('id', city.id);
		} finally {
			busy = false;
		}
	}

	$effect(() => {
		if (!sessionChecked) return;
		const supabase = getBrowserSupabase();
		const gameId = initial.game.id;

		async function refetchPlayers() {
			const { data: rows } = await supabase
				.from('players')
				.select('*')
				.eq('game_id', gameId)
				.order('slot_index');
			if (rows) players = rows;
		}
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

		const channel = supabase
			.channel('admin:' + gameId)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
				() => {
					refetchGame();
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
				{ event: '*', schema: 'public', table: 'diseases', filter: `game_id=eq.${gameId}` },
				() => {
					refetchDiseases();
				}
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'game_cities', filter: `game_id=eq.${gameId}` },
				() => {
					refetchCities();
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	});
</script>

<div class="relative min-h-svh bg-background text-foreground">
	<div
		class="pointer-events-none absolute inset-0 -z-10 opacity-20 [background:radial-gradient(circle_at_1px_1px,theme(colors.foreground/0.12)_1px,transparent_0)] [background-size:24px_24px]"
	></div>

	<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 md:py-10">
		{#if !sessionChecked}
			<div class="flex items-center justify-center py-24">
				<span class="text-sm text-muted-foreground">Načítám…</span>
			</div>
		{:else}
			<!-- Header -->
			<header class="flex flex-wrap items-start justify-between gap-4">
				<div class="flex flex-col gap-1">
					<span class="text-xs uppercase tracking-[0.22em] text-muted-foreground">
						Vedoucí · {session?.display_name ?? ''}
					</span>
					<h1 class="text-3xl font-semibold tracking-tight md:text-4xl">
						{game.name ?? 'Krizový štáb'}
					</h1>
					<div class="flex flex-wrap items-center gap-3">
						<code
							class="rounded-md border border-border bg-card px-3 py-1 font-mono text-xl tracking-[0.3em]"
						>
							{game.code}
						</code>
						<Badge variant={statusBadgeVariant(game.status)} class="uppercase tracking-wider">
							{statusLabel(game.status)}
						</Badge>
					</div>
				</div>

				<div class="flex flex-col items-end gap-2">
					<button
						type="button"
						onclick={copyLink}
						class="group flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-2 text-sm font-medium transition-colors hover:bg-card"
						aria-label="Zkopírovat odkaz pro hráče"
					>
						<span class="truncate max-w-[26ch] text-muted-foreground">
							{joinUrl.replace(/^https?:\/\//, '')}
						</span>
						{#if copied}
							<Check class="size-4 text-viridis" />
						{:else}
							<Copy class="size-4 text-muted-foreground group-hover:text-foreground" />
						{/if}
					</button>
				</div>
			</header>

			{#if errorMessage}
				<div
					role="alert"
					class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
				>
					{errorMessage}
				</div>
			{/if}

			<div class="grid gap-6 lg:grid-cols-[1fr_320px]">
				<!-- Main column -->
				<div class="flex min-w-0 flex-col gap-6">
					{#if game.status === 'lobby'}
						<Card class="bg-card/60">
							<CardHeader>
								<CardTitle class="text-base">Pozvánka</CardTitle>
							</CardHeader>
							<CardContent class="flex flex-col gap-4">
								<div class="flex items-stretch gap-4">
									<div
										class="flex size-32 shrink-0 items-center justify-center rounded-lg border border-dashed border-border/70 bg-background/60 text-muted-foreground"
									>
										<div class="flex flex-col items-center gap-1">
											<QrCode class="size-8" />
											<span class="font-mono text-[10px] tracking-widest">
												{game.code}
											</span>
										</div>
									</div>
									<div class="flex min-w-0 flex-1 flex-col justify-between gap-2">
										<div>
											<span class="text-xs uppercase tracking-[0.2em] text-muted-foreground">
												Odkaz pro hráče
											</span>
											<p class="break-all font-mono text-sm">
												{joinUrl}
											</p>
										</div>
										<Button
											variant="default"
											onclick={startGame}
											disabled={busy || players.length === 0}
											class="self-start"
										>
											<Play class="size-4" />
											Spustit hru
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>
					{/if}

					<!-- Roster -->
					<Card class="bg-card/60">
						<CardHeader>
							<CardTitle class="flex items-center justify-between text-base">
								<span>Tým ({players.length})</span>
								<span class="text-xs font-normal text-muted-foreground">
									Připojení 30 s
								</span>
							</CardTitle>
						</CardHeader>
						<CardContent class="flex flex-col gap-2">
							{#if sortedPlayers.length === 0}
								<p class="text-sm text-muted-foreground">
									Zatím nikdo nepřipojen. Předej kód týmu.
								</p>
							{/if}
							{#each sortedPlayers as p (p.id)}
								<div
									class="flex flex-wrap items-center gap-3 rounded-lg border border-border/40 bg-background/40 px-3 py-2"
								>
									<span
										class="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-[11px]"
									>
										#{p.slot_index + 1}
									</span>
									<div class="flex min-w-0 flex-1 flex-col">
										<span class="truncate text-sm font-medium">
											{p.display_name}{p.is_admin ? ' · vedoucí' : ''}
										</span>
										<span class="truncate text-[11px] text-muted-foreground">
											{p.role ? ROLE_LABELS[p.role].name : 'Bez role'}
										</span>
									</div>

									<label class="sr-only" for={`role-${p.id}`}>Role</label>
									<select
										id={`role-${p.id}`}
										class="h-8 rounded-md border border-border bg-background px-2 text-xs"
										value={p.role ?? ''}
										onchange={(e) => {
											const v = e.currentTarget.value;
											updatePlayerRole(p.id, v === '' ? null : (v as PlayerRole));
										}}
									>
										<option value="">— Bez role —</option>
										{#each allRoles as r (r)}
											<option value={r}>{ROLE_LABELS[r].name}</option>
										{/each}
									</select>

									{#if isConnected(p)}
										<Badge variant="default" class="bg-viridis/20 text-viridis">
											Připojen
										</Badge>
									{:else}
										<Badge variant="outline" class="text-muted-foreground">
											Offline
										</Badge>
									{/if}
								</div>
							{/each}
						</CardContent>
					</Card>

					<!-- Phase / lifecycle controls -->
					{#if game.status === 'active'}
						<Card class="bg-card/60">
							<CardHeader>
								<CardTitle class="text-base">Průběh hry</CardTitle>
							</CardHeader>
							<CardContent class="flex flex-col gap-4">
								<div class="flex flex-wrap items-center justify-between gap-3">
									<div class="flex flex-col">
										<span class="text-xs uppercase tracking-[0.2em] text-muted-foreground">
											Aktuální fáze
										</span>
										<span class="text-xl font-semibold">
											{game.current_phase
												? PHASE_LABELS[game.current_phase]
												: '—'}
										</span>
										<span class="text-xs text-muted-foreground">
											Kolo {game.current_round} / {settings.round_count}
										</span>
									</div>
									<Button onclick={advancePhase} disabled={busy}>
										<ChevronRight class="size-4" />
										Další fáze
									</Button>
								</div>

								<Separator />

								<div class="flex flex-wrap gap-2">
									<Button variant="outline" onclick={pauseGame} disabled={busy}>
										<Pause class="size-4" />
										Pauznout
									</Button>
									<Button variant="destructive" onclick={endGame} disabled={busy}>
										<Square class="size-4" />
										Ukončit hru
									</Button>
								</div>
							</CardContent>
						</Card>

						<!-- Manual overrides -->
						<Card class="bg-card/40">
							<CardHeader>
								<CardTitle class="text-base">Ruční zásahy</CardTitle>
							</CardHeader>
							<CardContent class="flex flex-wrap gap-2">
								<Button variant="outline" onclick={infectRandom} disabled={busy}>
									<Shuffle class="size-4" />
									+1 infekce náhodnému městu
								</Button>
							</CardContent>
						</Card>
					{:else if game.status === 'paused'}
						<Card class="bg-card/60">
							<CardHeader>
								<CardTitle class="text-base">Pauza</CardTitle>
							</CardHeader>
							<CardContent class="flex flex-wrap gap-2">
								<Button
									onclick={async () => {
										if (busy) return;
										busy = true;
										try {
											const supabase = getBrowserSupabase();
											await supabase
												.from('games')
												.update({ status: 'active' })
												.eq('id', game.id);
										} finally {
											busy = false;
										}
									}}
									disabled={busy}
								>
									<Play class="size-4" />
									Pokračovat
								</Button>
								<Button variant="destructive" onclick={endGame} disabled={busy}>
									<Square class="size-4" />
									Ukončit hru
								</Button>
							</CardContent>
						</Card>
					{:else if game.status === 'finished'}
						<Card class="bg-card/40">
							<CardHeader>
								<CardTitle class="text-base">Hra skončila</CardTitle>
							</CardHeader>
							<CardContent class="text-sm text-muted-foreground">
								Důvod: {game.finish_reason ?? '—'}
							</CardContent>
						</Card>
					{/if}

					<!-- Diseases summary (active+) -->
					{#if diseases.length > 0}
						<Card class="bg-card/40">
							<CardHeader>
								<CardTitle class="text-base">Nemoci</CardTitle>
							</CardHeader>
							<CardContent class="flex flex-wrap gap-2">
								{#each diseases as d (d.id)}
									<Badge
										variant="default"
										class={`bg-${d.key as DiseaseKey}/20 text-${d.key as DiseaseKey} ${d.cured ? 'opacity-50' : ''}`}
									>
										{d.name} · {d.cure_stage}/4
									</Badge>
								{/each}
							</CardContent>
						</Card>
					{/if}
				</div>

				<!-- Right rail map thumbnail -->
				<aside class="flex flex-col gap-3">
					<span class="text-xs uppercase tracking-[0.2em] text-muted-foreground">
						Mapa
					</span>
					<div
						class="aspect-[10/7] w-full overflow-hidden rounded-lg border border-border/40 bg-card/40"
					>
						<MapCanvas map={initial.map} {cities} />
					</div>
					<div class="flex flex-wrap items-center justify-between gap-2 text-xs">
						<span class="text-muted-foreground">{cities.length} / {initial.map.payload.cities.length} měst</span>
						<a
							href={`/board/${code}`}
							class="text-muted-foreground underline-offset-4 hover:underline"
							target="_blank"
							rel="noreferrer"
						>
							Otevřít projektor →
						</a>
					</div>
				</aside>
			</div>
		{/if}
	</div>
</div>
