<script lang="ts">
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import { getBrowserSupabase } from '$lib/supabase/client';
	import { loadSession, saveSession, type PlayerSession } from '$lib/session';
	import { gameApi, GameApiError, whoami } from '$lib/api';
	import {
		DEFAULT_SETTINGS,
		DISEASE_KEYS,
		DISEASE_THEMES,
		PHASE_LABELS,
		ROLE_LABELS,
		type DiseaseTheme
	} from '$lib/game/constants';
	import { formatFinishReason } from '$lib/game/events';
	import type {
		GameRow,
		PlayerRow,
		DiseaseRow,
		GameCityRow,
		PlayerRole,
		DiseaseKey,
		CrisisDrawRow,
		CrisisCardRow
	} from '$lib/supabase/types';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import MapCanvas from '$lib/components/game/MapCanvas.svelte';
	import BrandMark from '$lib/components/game/BrandMark.svelte';
	import {
		Copy,
		Check,
		Play,
		Pause,
		Square,
		ChevronRight,
		Shuffle,
		QrCode,
		Sparkles,
		AlertTriangle,
		KeyRound
	} from 'lucide-svelte';

	type CrisisCardOption = { key: string; label: string; effects?: Record<string, unknown>[] };
	type CrisisDrawWithCard = CrisisDrawRow & { card: CrisisCardRow };
	type Targets = { player: boolean; city: boolean; disease: boolean };

	let { data }: { data: PageData } = $props();

	const initial = untrack(() => data.initial);

	let game = $state<GameRow>(initial.game);
	let players = $state<PlayerRow[]>(initial.players);
	let diseases = $state<DiseaseRow[]>(initial.diseases);
	let cities = $state<GameCityRow[]>(initial.cities);
	let activeDraw = $state<CrisisDrawWithCard | null>(null);
	let pendingOptionKey = $state<string | null>(null);
	let pendingPlayerId = $state<string | null>(null);
	let pendingCityKey = $state<string | null>(null);
	let pendingDisease = $state<DiseaseKey | null>(null);

	type CrisisVote = {
		event_id: number;
		player_id: string;
		player_name: string;
		option_key: string;
		at: string;
	};
	let voteEvents = $state<CrisisVote[]>([]);

	const latestVoteByPlayer = $derived.by(() => {
		const m = new Map<string, CrisisVote>();
		for (const v of voteEvents) {
			const prev = m.get(v.player_id);
			if (!prev || new Date(v.at).getTime() > new Date(prev.at).getTime()) {
				m.set(v.player_id, v);
			}
		}
		return m;
	});

	const votesByOption = $derived.by(() => {
		const m = new Map<string, CrisisVote[]>();
		for (const v of latestVoteByPlayer.values()) {
			const list = m.get(v.option_key) ?? [];
			list.push(v);
			m.set(v.option_key, list);
		}
		return m;
	});

	function votersFor(optionKey: string): CrisisVote[] {
		return votesByOption.get(optionKey) ?? [];
	}

	let session = $state<PlayerSession | null>(null);
	let sessionChecked = $state(false);
	let copied = $state(false);
	let recoveryCopied = $state(false);
	let busy = $state(false);
	let errorMessage = $state<string | null>(null);

	const code = $derived((page.params.code ?? '').toUpperCase());

	$effect(() => {
		void code;
		(async () => {
			const existing = loadSession(code);
			if (existing && existing.is_admin) {
				session = existing;
				sessionChecked = true;
				return;
			}

			const token = page.url.searchParams.get('token');
			if (token) {
				try {
					const restored = await whoami(code, token);
					if (!restored.is_admin) {
						errorMessage = 'Tento odkaz patří hráči, ne vedoucímu.';
						goto('/');
						return;
					}
					saveSession(restored);
					session = restored;
					sessionChecked = true;
					const url = new URL(page.url);
					url.searchParams.delete('token');
					replaceState(url, page.state);
					return;
				} catch (e) {
					errorMessage =
						e instanceof GameApiError ? e.message : 'Záchranný odkaz je neplatný.';
				}
			}

			goto('/');
		})();
	});

	const joinUrl = $derived(`${page.url.origin}/join?code=${code}`);
	const recoveryUrl = $derived(
		session ? `${page.url.origin}/admin/${code}?token=${session.device_token}` : ''
	);

	async function copyRecoveryLink() {
		if (!recoveryUrl) return;
		try {
			await navigator.clipboard.writeText(recoveryUrl);
			recoveryCopied = true;
			setTimeout(() => {
				recoveryCopied = false;
			}, 1800);
		} catch {
			// ignore
		}
	}

	const settings = $derived(
		(game.settings as Partial<typeof DEFAULT_SETTINGS> | null) ?? DEFAULT_SETTINGS
	);

	const theme = $derived.by<DiseaseTheme>(() => {
		const t = (game.settings as { theme?: DiseaseTheme } | null)?.theme;
		return t === 'scout' ? 'scout' : 'clinical';
	});
	const diseaseLabels = $derived(DISEASE_THEMES[theme]);

	const orderedDiseases = $derived.by(() => {
		const out: DiseaseRow[] = [];
		for (const k of DISEASE_KEYS) {
			const d = diseases.find((x) => x.key === k);
			if (d) out.push(d);
		}
		return out;
	});

	const sortedPlayers = $derived([...players].sort((a, b) => a.slot_index - b.slot_index));

	const drawOptions = $derived.by<CrisisCardOption[]>(() => {
		const raw = activeDraw?.card?.options;
		if (!Array.isArray(raw)) return [];
		return raw as CrisisCardOption[];
	});

	function targetsForEffect(effect: Record<string, unknown>): Targets {
		const t: Targets = { player: false, city: false, disease: false };
		const kind = effect.kind as string | undefined;
		switch (kind) {
			case 'cure_advance':
			case 'cure_rollback':
				if (!effect.disease) t.disease = true;
				break;
			case 'quarantine_choose':
				if (!effect.city_key) t.city = true;
				break;
			case 'player_infect':
				if (!effect.player_id) t.player = true;
				if (!effect.disease) t.disease = true;
				break;
		}
		return t;
	}

	function targetsForOption(option: CrisisCardOption | undefined): Targets {
		const out: Targets = { player: false, city: false, disease: false };
		if (!option?.effects) return out;
		for (const e of option.effects) {
			const t = targetsForEffect(e);
			if (t.player) out.player = true;
			if (t.city) out.city = true;
			if (t.disease) out.disease = true;
		}
		return out;
	}

	const pendingOption = $derived(
		drawOptions.find((o) => o.key === pendingOptionKey) ?? null
	);
	const pendingTargets = $derived(targetsForOption(pendingOption ?? undefined));
	const pendingReady = $derived(
		(!pendingTargets.player || !!pendingPlayerId) &&
			(!pendingTargets.city || !!pendingCityKey) &&
			(!pendingTargets.disease || !!pendingDisease)
	);

	$effect(() => {
		void activeDraw?.id;
		pendingOptionKey = null;
		pendingPlayerId = null;
		pendingCityKey = null;
		pendingDisease = null;
	});

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
		try {
			await gameApi.setRole(code, playerId, role);
		} catch (e) {
			errorMessage = e instanceof GameApiError ? e.message : (e as Error).message;
		}
	}

	async function withBusy(fn: () => Promise<void>) {
		if (busy) return;
		busy = true;
		errorMessage = null;
		try {
			await fn();
		} catch (e) {
			errorMessage = e instanceof GameApiError ? e.message : (e as Error).message;
		} finally {
			busy = false;
		}
	}

	async function startGame() {
		await withBusy(async () => {
			await gameApi.start(code);
		});
	}

	async function advancePhase() {
		await withBusy(async () => {
			await gameApi.advancePhase(code);
		});
	}

	async function pauseGame() {
		await withBusy(async () => {
			await gameApi.setStatus(code, 'paused');
		});
	}

	async function resumeGame() {
		await withBusy(async () => {
			await gameApi.setStatus(code, 'active');
		});
	}

	async function endGame() {
		await withBusy(async () => {
			await gameApi.setStatus(code, 'finished', 'manual_admin_end');
		});
	}

	async function infectRandom() {
		if (cities.length === 0) return;
		await withBusy(async () => {
			await gameApi.infectRandom(code);
		});
	}

	async function drawCrisis() {
		await withBusy(async () => {
			await gameApi.drawCrisis(code);
		});
	}

	async function advanceCure(disease: DiseaseKey) {
		await withBusy(async () => {
			await gameApi.advanceCure(code, disease, 'advance');
		});
	}

	async function rollbackCure(disease: DiseaseKey) {
		await withBusy(async () => {
			await gameApi.advanceCure(code, disease, 'rollback');
		});
	}

	async function healPlayer(playerId: string, disease: DiseaseKey) {
		await withBusy(async () => {
			await gameApi.healPlayer(code, playerId, disease, 1);
		});
	}

	function playerInfectionStage(p: PlayerRow, key: DiseaseKey): number {
		const raw = p.infection_levels;
		if (typeof raw !== 'object' || raw === null) return 0;
		const v = (raw as Record<string, unknown>)[key];
		return typeof v === 'number' ? Math.max(0, Math.min(3, Math.round(v))) : 0;
	}

	function chooseOption(optionKey: string) {
		const option = drawOptions.find((o) => o.key === optionKey);
		if (!option) return;
		const t = targetsForOption(option);
		if (!t.player && !t.city && !t.disease) {
			confirmResolve(optionKey);
			return;
		}
		pendingOptionKey = optionKey;
		pendingPlayerId = null;
		pendingCityKey = null;
		pendingDisease = null;
	}

	function cancelPending() {
		pendingOptionKey = null;
		pendingPlayerId = null;
		pendingCityKey = null;
		pendingDisease = null;
	}

	async function confirmResolve(optionKey?: string) {
		const draw = activeDraw;
		const key = optionKey ?? pendingOptionKey;
		if (!draw || !key) return;
		const args: {
			draw_id: string;
			option_key: string;
			chosen_player_id?: string;
			chosen_city_key?: string;
			chosen_disease?: DiseaseKey;
		} = { draw_id: draw.id, option_key: key };
		if (pendingPlayerId) args.chosen_player_id = pendingPlayerId;
		if (pendingCityKey) args.chosen_city_key = pendingCityKey;
		if (pendingDisease) args.chosen_disease = pendingDisease;
		await withBusy(async () => {
			await gameApi.resolveCrisis(code, args);
		});
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
		async function refetchActiveDraw() {
			const { data: row } = await supabase
				.from('crisis_draws')
				.select('*, card:crisis_cards(*)')
				.eq('game_id', gameId)
				.is('applied_at', null)
				.order('drawn_at', { ascending: false })
				.limit(1)
				.maybeSingle();
			activeDraw = (row as CrisisDrawWithCard | null) ?? null;
			await refetchVotes();
		}
		async function refetchVotes() {
			const drawId = activeDraw?.id;
			if (!drawId) {
				voteEvents = [];
				return;
			}
			const { data: rows } = await supabase
				.from('events_log')
				.select('id, at, payload')
				.eq('game_id', gameId)
				.eq('kind', 'crisis_vote')
				.order('at', { ascending: true });
			if (!rows) return;
			const next: CrisisVote[] = [];
			for (const r of rows) {
				const p = (r.payload as Record<string, unknown>) ?? {};
				if (p.draw_id !== drawId) continue;
				if (typeof p.player_id !== 'string' || typeof p.option_key !== 'string') continue;
				next.push({
					event_id: r.id,
					player_id: p.player_id,
					player_name: typeof p.player_name === 'string' ? p.player_name : '',
					option_key: p.option_key,
					at: r.at
				});
			}
			voteEvents = next;
		}
		refetchActiveDraw();

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
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'crisis_draws', filter: `game_id=eq.${gameId}` },
				() => {
					refetchActiveDraw();
				}
			)
			.on(
				'postgres_changes',
				{ event: 'INSERT', schema: 'public', table: 'events_log', filter: `game_id=eq.${gameId}` },
				(payload) => {
					const row = payload.new as { id: number; at: string; kind: string; payload: Record<string, unknown> };
					if (row.kind !== 'crisis_vote') return;
					const drawId = activeDraw?.id;
					const p = row.payload ?? {};
					if (!drawId || p.draw_id !== drawId) return;
					if (typeof p.player_id !== 'string' || typeof p.option_key !== 'string') return;
					voteEvents = [
						...voteEvents,
						{
							event_id: row.id,
							player_id: p.player_id,
							player_name: typeof p.player_name === 'string' ? p.player_name : '',
							option_key: p.option_key,
							at: row.at
						}
					];
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
				<div class="flex items-start gap-4">
					<a href="/" aria-label="Domů" class="shrink-0">
						<BrandMark size={56} class="rounded-md" />
					</a>
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
				</div>

				<div class="flex flex-col items-end gap-2">
					<button
						type="button"
						onclick={copyLink}
						class="group flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-2 text-sm font-medium transition-colors hover:bg-card"
						aria-label="Zkopírovat odkaz pro hráče"
					>
						<span class="max-w-[26ch] truncate text-muted-foreground">
							{joinUrl.replace(/^https?:\/\//, '')}
						</span>
						{#if copied}
							<Check class="size-4 text-viridis" />
						{:else}
							<Copy class="size-4 text-muted-foreground group-hover:text-foreground" />
						{/if}
					</button>
					<button
						type="button"
						onclick={copyRecoveryLink}
						class="group flex items-center gap-2 rounded-md border border-dashed border-border/70 bg-card/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-card/60 hover:text-foreground"
						aria-label="Zkopírovat záchranný odkaz pro vedoucího"
						title="Bookmarkni tento odkaz nebo si ho pošli — obnoví relaci vedoucího na jiném zařízení."
					>
						<KeyRound class="size-3.5" />
						{recoveryCopied ? 'Zkopírováno' : 'Záchranný odkaz vedoucího'}
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
									class="flex flex-col gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2"
								>
									<div class="flex flex-wrap items-center gap-3">
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

									{#if game.status === 'active' && !p.is_admin}
										<div class="flex flex-wrap items-center gap-2 pl-10">
											<span class="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
												Nákaza
											</span>
											{#each DISEASE_KEYS as k (k)}
												{@const stage = playerInfectionStage(p, k)}
												<button
													type="button"
													onclick={() => healPlayer(p.id, k)}
													disabled={busy || stage === 0}
													title={`Vyléčit ${diseaseLabels[k]} o jeden stupeň`}
													class="flex items-center gap-1 rounded-md border border-border/50 bg-background/60 px-2 py-1 text-[11px] transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-40"
												>
													<span
														class="size-2 rounded-full"
														style={`background-color: var(--${k});`}
														aria-hidden="true"
													></span>
													<span class="font-mono tabular-nums">{stage}</span>
												</button>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</CardContent>
					</Card>

					<!-- Phase / lifecycle controls -->
					{#if game.status === 'active'}
						<!-- Active crisis card -->
						{#if activeDraw}
							<Card class="border-aurum/40 bg-aurum/5">
								<CardHeader>
									<CardTitle class="flex items-center gap-2 text-base">
										<AlertTriangle class="size-4 text-aurum" />
										Krize: {activeDraw.card.title}
									</CardTitle>
								</CardHeader>
								<CardContent class="flex flex-col gap-3">
									<p class="text-sm text-foreground/90">
										{activeDraw.card.body}
									</p>
									{@const totalVotes = latestVoteByPlayer.size}
									<div class="flex flex-col gap-2">
										{#each drawOptions as opt (opt.key)}
											{@const voters = votersFor(opt.key)}
											{@const count = voters.length}
											<div class="flex flex-wrap items-center gap-2">
												<Button
													variant={pendingOptionKey === opt.key ? 'default' : 'outline'}
													onclick={() => chooseOption(opt.key)}
													disabled={busy}
													class="min-w-32 justify-start"
												>
													<span class="flex-1 text-left">{opt.label}</span>
													<span
														class={[
															'ml-3 rounded-full px-2 py-0.5 font-mono text-[11px] tabular-nums',
															count > 0
																? 'bg-aurum/20 text-aurum'
																: 'bg-muted text-muted-foreground'
														].join(' ')}
														aria-label={`${count} hlasů`}
													>
														{count}
													</span>
												</Button>
												{#if count > 0}
													<span class="text-[11px] text-muted-foreground">
														{voters.map((v) => v.player_name || '?').join(', ')}
													</span>
												{/if}
											</div>
										{/each}
										<span class="text-[11px] text-muted-foreground">
											{totalVotes > 0
												? `Hlasovalo ${totalVotes} z ${players.filter((pl) => !pl.is_admin).length} hráčů.`
												: 'Zatím žádné hlasy.'}
										</span>
									</div>

									{#if pendingOption}
										<div
											class="flex flex-col gap-3 rounded-lg border border-aurum/30 bg-background/50 p-3"
										>
											<span class="text-xs uppercase tracking-[0.2em] text-muted-foreground">
												Cíl pro volbu „{pendingOption.label}"
											</span>

											{#if pendingTargets.player}
												<label class="flex flex-col gap-1 text-xs">
													<span class="text-muted-foreground">Hráč</span>
													<select
														bind:value={pendingPlayerId}
														class="h-9 rounded-md border border-border bg-background px-2 text-sm"
													>
														<option value={null}>— Vyber hráče —</option>
														{#each sortedPlayers as p (p.id)}
															<option value={p.id}>
																{p.display_name}{p.role ? ` · ${ROLE_LABELS[p.role].name}` : ''}
															</option>
														{/each}
													</select>
												</label>
											{/if}

											{#if pendingTargets.city}
												<label class="flex flex-col gap-1 text-xs">
													<span class="text-muted-foreground">Město</span>
													<select
														bind:value={pendingCityKey}
														class="h-9 rounded-md border border-border bg-background px-2 text-sm"
													>
														<option value={null}>— Vyber město —</option>
														{#each [...cities].sort( (a, b) => a.name.localeCompare(b.name) ) as c (c.id)}
															<option value={c.map_city_key}>
																{c.name}{c.in_quarantine ? ' (karanténa)' : ''}
															</option>
														{/each}
													</select>
												</label>
											{/if}

											{#if pendingTargets.disease}
												<label class="flex flex-col gap-1 text-xs">
													<span class="text-muted-foreground">Nemoc</span>
													<select
														bind:value={pendingDisease}
														class="h-9 rounded-md border border-border bg-background px-2 text-sm"
													>
														<option value={null}>— Vyber nemoc —</option>
														{#each diseases as d (d.id)}
															<option value={d.key}>
																{d.name}{d.cured ? ' (vyléčeno)' : ''}
															</option>
														{/each}
													</select>
												</label>
											{/if}

											<div class="flex flex-wrap gap-2">
												<Button
													variant="default"
													onclick={() => confirmResolve()}
													disabled={busy || !pendingReady}
												>
													Vyhodnotit
												</Button>
												<Button
													variant="ghost"
													onclick={cancelPending}
													disabled={busy}
												>
													Zrušit
												</Button>
											</div>
										</div>
									{/if}

									<span class="text-xs text-muted-foreground">
										Volba se vyhodnotí enginem a propíše do mapy.
									</span>
								</CardContent>
							</Card>
						{/if}

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
								<Button
									variant="outline"
									onclick={drawCrisis}
									disabled={busy || !!activeDraw}
								>
									<Sparkles class="size-4" />
									Vylosovat krizi
								</Button>
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
								<Button onclick={resumeGame} disabled={busy}>
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
								Důvod: {formatFinishReason(game.finish_reason)}
							</CardContent>
						</Card>
					{/if}

					<!-- Vývoj léku — vedoucí posouvá po splnění fyzické úlohy -->
					{#if orderedDiseases.length > 0}
						<Card class="bg-card/40">
							<CardHeader>
								<CardTitle class="text-base">Vývoj léku</CardTitle>
							</CardHeader>
							<CardContent class="flex flex-col gap-2">
								{#each orderedDiseases as d (d.id)}
									<div
										class="flex flex-wrap items-center gap-3 rounded-lg border border-border/40 bg-background/40 px-3 py-2"
									>
										<span
											class="size-3 shrink-0 rounded-full"
											style={`background-color: var(--${d.key});`}
											aria-hidden="true"
										></span>
										<span class="min-w-0 flex-1 truncate text-sm font-medium">{d.name}</span>
										<div class="flex gap-1" aria-label={`Pokrok ${d.cure_stage} ze 4`}>
											{#each [0, 1, 2, 3] as i (i)}
												<span
													class={[
														'size-3 rounded-sm border border-border/50',
														i < d.cure_stage ? '' : 'bg-background/40'
													].join(' ')}
													style={i < d.cure_stage
														? `background-color: var(--${d.key});`
														: ''}
												></span>
											{/each}
										</div>
										<span class="w-10 text-right font-mono text-xs tabular-nums text-muted-foreground">
											{d.cure_stage}/4
										</span>
										{#if game.status === 'active'}
											<div class="flex gap-1">
												<Button
													variant="outline"
													size="sm"
													disabled={busy || d.cured}
													onclick={() => advanceCure(d.key)}
													title="Splnil úkol — posunout fázi"
												>
													+1
												</Button>
												<Button
													variant="ghost"
													size="sm"
													disabled={busy || d.cure_stage === 0}
													onclick={() => rollbackCure(d.key)}
													title="Vrátit fázi zpět"
												>
													−1
												</Button>
											</div>
										{:else if d.cured}
											<span class="text-[10px] uppercase tracking-widest text-viridis">
												vyléčeno
											</span>
										{/if}
									</div>
								{/each}
								{#if game.status === 'active'}
									<span class="text-[11px] text-muted-foreground">
										Hráč splní fyzickou úlohu na stanici → posuneš fázi tlačítkem „+1".
									</span>
								{/if}
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
						<span class="text-muted-foreground"
							>{cities.length} / {initial.map.payload.cities.length} měst</span
						>
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
