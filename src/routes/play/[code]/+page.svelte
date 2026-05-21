<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { PageData } from './$types';
	import { getBrowserSupabase } from '$lib/supabase/client';
	import { loadSession, type PlayerSession } from '$lib/session';
	import { gameApi, GameApiError } from '$lib/api';
	import { maxInfectionStage, infectionStage } from '$lib/game/load';
	import {
		DISEASE_KEYS,
		DISEASE_THEMES,
		MOVEMENT_RULES,
		PHASE_LABELS,
		ROLE_LABELS,
		type DiseaseTheme
	} from '$lib/game/constants';
	import type {
		GameRow,
		PlayerRow,
		DiseaseRow,
		GameCityRow,
		DiseaseKey,
		PlayerRole,
		CrisisDrawRow,
		CrisisCardRow
	} from '$lib/supabase/types';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import RoleCard from '$lib/components/game/RoleCard.svelte';
	import PhaseTimer from '$lib/components/game/PhaseTimer.svelte';
	import InfectionRing from '$lib/components/game/InfectionRing.svelte';
	import { LifeBuoy, Hourglass, AlertTriangle, FlaskConical } from 'lucide-svelte';
	import { untrack } from 'svelte';

	type CrisisCardOption = { key: string; label: string };
	type CrisisDrawWithCard = CrisisDrawRow & { card: CrisisCardRow };

	let { data }: { data: PageData } = $props();

	const code = $derived((page.params.code ?? '').toUpperCase());

	const initial = untrack(() => data.initial);

	let game = $state<GameRow>(initial.game);
	let players = $state<PlayerRow[]>(initial.players);
	let diseases = $state<DiseaseRow[]>(initial.diseases);
	let cities = $state<GameCityRow[]>(initial.cities);
	let activeDraw = $state<CrisisDrawWithCard | null>(null);
	let myVote = $state<string | null>(null);
	let cureBusy = $state<DiseaseKey | null>(null);
	let toastMessage = $state<string | null>(null);

	let session = $state<PlayerSession | null>(null);
	let sessionChecked = $state(false);

	$effect(() => {
		const s = loadSession(code);
		if (!s) {
			goto(`/join?code=${code}`);
			return;
		}
		session = s;
		sessionChecked = true;
	});

	const myPlayer = $derived.by(() => {
		const s = session;
		if (!s) return null;
		return players.find((p) => p.id === s.player_id) ?? null;
	});

	const leaderPlayer = $derived(players.find((p) => p.is_admin) ?? null);

	const myInfectionLevels = $derived.by(() => {
		const out: Record<DiseaseKey, number> = { rubra: 0, viridis: 0, nox: 0, aurum: 0 };
		if (!myPlayer) return out;
		for (const k of DISEASE_KEYS) {
			out[k] = infectionStage(myPlayer.infection_levels, k);
		}
		return out;
	});

	const myMaxStage = $derived(maxInfectionStage(myPlayer?.infection_levels ?? {}));

	const movementRule = $derived(MOVEMENT_RULES[myMaxStage as 0 | 1 | 2 | 3]);

	const stageCardClass = $derived.by(() => {
		switch (myMaxStage) {
			case 0:
				return 'bg-stage-safe/15 border-stage-safe/30 text-foreground';
			case 1:
				return 'bg-stage-1/15 border-stage-1/40 text-foreground';
			case 2:
				return 'bg-stage-2/20 border-stage-2/50 text-foreground';
			default:
				return 'bg-stage-3/25 border-stage-3/60 text-foreground';
		}
	});

	const theme = $derived.by<DiseaseTheme>(() => {
		const t = (game.settings as { theme?: DiseaseTheme } | null)?.theme;
		return t === 'scout' ? 'scout' : 'clinical';
	});

	const diseaseLabels = $derived(DISEASE_THEMES[theme]);

	const drawOptions = $derived.by<CrisisCardOption[]>(() => {
		const raw = activeDraw?.card?.options;
		if (!Array.isArray(raw)) return [];
		return raw as CrisisCardOption[];
	});

	function diseaseBadgeClass(key: DiseaseKey, stage: number) {
		const colorMap: Record<DiseaseKey, string> = {
			rubra: 'bg-rubra/20 text-rubra',
			viridis: 'bg-viridis/20 text-viridis',
			nox: 'bg-nox/25 text-nox',
			aurum: 'bg-aurum/25 text-aurum'
		};
		return `${colorMap[key]} ${stage > 0 ? 'animate-pulse' : 'opacity-60'}`;
	}

	function initials(name: string) {
		return name
			.split(/\s+/)
			.map((s) => s[0])
			.filter(Boolean)
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}

	function dotColor(key: DiseaseKey) {
		return `var(--${key})`;
	}

	function roleLabel(r: PlayerRole | null) {
		return r ? ROLE_LABELS[r].name : 'Bez role';
	}

	function sortedPlayers(list: PlayerRow[]) {
		return [...list].sort((a, b) => a.slot_index - b.slot_index);
	}

	function pingToast(msg: string) {
		toastMessage = msg;
		setTimeout(() => {
			if (toastMessage === msg) toastMessage = null;
		}, 2500);
	}

	async function voteOnCrisis(optionKey: string) {
		if (!activeDraw) return;
		const drawId = activeDraw.id;
		try {
			await gameApi.logEvent(code, 'crisis_vote', { draw_id: drawId, option_key: optionKey });
			myVote = optionKey;
			pingToast('Hlas zaznamenán. Vedoucí dilema vyhodnotí.');
		} catch (e) {
			pingToast(e instanceof GameApiError ? e.message : 'Hlas se neuložil.');
		}
	}

	async function requestCure(disease: DiseaseKey) {
		if (cureBusy) return;
		cureBusy = disease;
		try {
			await gameApi.advanceCure(code, disease, 'advance');
			pingToast(`Posun léku: ${diseaseLabels[disease]}`);
		} catch (e) {
			pingToast(e instanceof GameApiError ? e.message : 'Nepodařilo se posunout lék.');
		} finally {
			cureBusy = null;
		}
	}

	// reset advisory vote when the crisis changes
	$effect(() => {
		void activeDraw?.id;
		myVote = null;
	});

	// Realtime subscriptions
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
		async function refetchDiseases() {
			const { data: rows } = await supabase.from('diseases').select('*').eq('game_id', gameId);
			if (rows) diseases = rows;
		}
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
		}
		refetchActiveDraw();

		const channel = supabase
			.channel('game:' + gameId)
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
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	});

	async function handleSos() {
		try {
			await gameApi.logEvent(code, 'sos', {});
			pingToast('SOS odesláno týmu.');
		} catch (e) {
			pingToast(e instanceof GameApiError ? e.message : 'SOS se nepodařilo odeslat.');
		}
	}
</script>

<div class="relative min-h-svh bg-background text-foreground">
	<div
		class="pointer-events-none absolute inset-0 -z-10 opacity-20 [background:radial-gradient(circle_at_1px_1px,theme(colors.foreground/0.12)_1px,transparent_0)] [background-size:24px_24px]"
	></div>

	<div class="mx-auto flex min-h-svh max-w-md flex-col gap-4 pb-32">
		<!-- Top bar -->
		<header
			class="sticky top-0 z-20 -mx-0 flex items-center justify-between gap-3 border-b border-border/40 bg-background/85 px-4 py-3 backdrop-blur"
		>
			<div class="flex flex-col">
				<span class="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
					Kolo {game.current_round || 0}
				</span>
				<span class="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
					{code}
				</span>
			</div>
			<PhaseTimer phase={game.current_phase} endsAt={game.phase_ends_at} />
		</header>

		{#if !sessionChecked}
			<div class="flex flex-1 items-center justify-center px-4">
				<span class="text-sm text-muted-foreground">Načítám tvoji relaci…</span>
			</div>
		{:else if !myPlayer}
			<div class="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
				<Hourglass class="size-10 text-muted-foreground" />
				<h1 class="text-2xl font-semibold tracking-tight">
					Hra začala bez tebe
				</h1>
				<p class="max-w-xs text-sm text-muted-foreground">
					Spojím tě jako diváka, ale do týmu už se v tomto kole nedostaneš.
				</p>
				<Button href="/" variant="outline">Zpět na úvod</Button>
			</div>
		{:else if game.status === 'lobby'}
			<section class="flex flex-1 flex-col gap-6 px-4 pt-4">
				<div class="flex flex-col items-center gap-3 pt-8 text-center">
					<Hourglass class="size-10 text-muted-foreground" />
					<h1 class="text-3xl font-semibold tracking-tight">Čekáme na vedoucího</h1>
					<p class="max-w-xs text-sm text-muted-foreground">
						{leaderPlayer
							? `${leaderPlayer.display_name} startuje krizový štáb.`
							: 'Vedoucí ti zanedlouho spustí hru.'}
					</p>
				</div>

				<RoleCard role={myPlayer.role} />

				<div class="flex flex-col gap-2">
					<span class="text-xs uppercase tracking-[0.2em] text-muted-foreground">
						Tým ({players.length})
					</span>
					<ul class="flex flex-col gap-2">
						{#each sortedPlayers(players) as p (p.id)}
							<li
								class={[
									'flex items-center gap-3 rounded-lg border border-border/40 bg-card/50 px-3 py-2',
									p.id === myPlayer.id ? 'ring-1 ring-primary' : ''
								].join(' ')}
							>
								<div
									class="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium uppercase tracking-wider"
								>
									{initials(p.display_name)}
								</div>
								<div class="flex min-w-0 flex-1 flex-col">
									<span class="truncate text-sm font-medium">
										{p.display_name}{p.is_admin ? ' · vedoucí' : ''}
									</span>
									<span class="truncate text-xs text-muted-foreground">
										{roleLabel(p.role)}
									</span>
								</div>
							</li>
						{/each}
					</ul>
				</div>
			</section>
		{:else}
			<!-- Active game UI -->
			<section class="flex flex-col gap-4 px-4">
				<!-- Active crisis dilemma -->
				{#if activeDraw}
					<div
						role="region"
						aria-label="Krizová karta"
						class="rounded-2xl border border-aurum/40 bg-aurum/5 px-4 py-4 shadow-sm"
					>
						<div class="flex items-center gap-2 text-aurum">
							<AlertTriangle class="size-4" />
							<span class="text-[10px] uppercase tracking-[0.22em]">Krize</span>
						</div>
						<h2 class="mt-1 text-xl font-semibold leading-tight tracking-tight">
							{activeDraw.card.title}
						</h2>
						<p class="mt-2 text-sm text-foreground/90">
							{activeDraw.card.body}
						</p>
						<div class="mt-3 flex flex-col gap-2">
							{#each drawOptions as opt (opt.key)}
								<Button
									variant={myVote === opt.key ? 'default' : 'outline'}
									class="justify-start"
									onclick={() => voteOnCrisis(opt.key)}
								>
									{opt.label}
									{#if myVote === opt.key}
										<span class="ml-auto text-[10px] uppercase tracking-widest opacity-80">
											tvůj hlas
										</span>
									{/if}
								</Button>
							{/each}
						</div>
						<p class="mt-2 text-[11px] text-muted-foreground">
							Hlasování je pomocné — vedoucí potvrdí výsledek.
						</p>
					</div>
				{/if}

				<!-- Movement indicator (LARGEST element) -->
				<div
					class={[
						'rounded-2xl border px-5 py-6 shadow-sm transition-colors',
						stageCardClass
					].join(' ')}
				>
					<div class="flex items-center justify-between">
						<span class="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
							Pohyb · stupeň {myMaxStage}
						</span>
						<InfectionRing stages={myInfectionLevels} size={32} />
					</div>
					<h2 class="mt-1 text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
						{movementRule.label}
					</h2>
					<p class="mt-2 text-sm text-foreground/80">
						{movementRule.detail}
					</p>
				</div>

				<RoleCard role={myPlayer.role} />

				<!-- My infection status -->
				<Card class="bg-card/60">
					<CardContent class="flex flex-col gap-3 py-4">
						<div class="flex items-center justify-between">
							<span class="text-xs uppercase tracking-[0.2em] text-muted-foreground">
								Tvoje nákaza
							</span>
						</div>
						<div class="grid grid-cols-2 gap-2">
							{#each DISEASE_KEYS as key (key)}
								{@const stage = myInfectionLevels[key]}
								<div
									class="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-background/40 px-3 py-2"
								>
									<div class="flex min-w-0 flex-col">
										<span class="truncate text-xs font-medium">
											{diseaseLabels[key]}
										</span>
										<span class="text-[10px] uppercase tracking-widest text-muted-foreground">
											stupeň
										</span>
									</div>
									<Badge variant="default" class={diseaseBadgeClass(key, stage)}>
										{stage}
									</Badge>
								</div>
							{/each}
						</div>
					</CardContent>
				</Card>

				<!-- Cure development -->
				{#if diseases.length > 0}
					<Card class="bg-card/60">
						<CardContent class="flex flex-col gap-3 py-4">
							<div class="flex items-center justify-between">
								<span class="text-xs uppercase tracking-[0.2em] text-muted-foreground">
									Vývoj léku
								</span>
								<FlaskConical class="size-4 text-muted-foreground" />
							</div>
							<div class="flex flex-col gap-2">
								{#each diseases as d (d.id)}
									<div class="flex items-center gap-2">
										<span
											class={`size-2.5 shrink-0 rounded-full bg-${d.key as DiseaseKey}`}
											aria-hidden="true"
										></span>
										<div class="flex min-w-0 flex-1 flex-col">
											<span class="truncate text-sm font-medium">{d.name}</span>
											<div
												class="mt-0.5 flex gap-1"
												aria-label={`Pokrok ${d.cure_stage} ze 4`}
											>
												{#each [0, 1, 2, 3] as i (i)}
													<span
														class={[
															'h-1.5 w-6 rounded-sm border border-border/40',
															i < d.cure_stage
																? `bg-${d.key as DiseaseKey}`
																: 'bg-background/40'
														].join(' ')}
													></span>
												{/each}
											</div>
										</div>
										<Button
											variant="outline"
											size="sm"
											disabled={d.cured || cureBusy === d.key}
											onclick={() => requestCure(d.key)}
										>
											{d.cured ? 'Vyléčeno' : cureBusy === d.key ? '…' : 'Posunout fázi'}
										</Button>
									</div>
								{/each}
							</div>
							<span class="text-[11px] text-muted-foreground">
								Splňte fyzickou úlohu na stanici a posuňte fázi vývoje.
							</span>
						</CardContent>
					</Card>
				{/if}

				<Separator />

				<!-- Team snapshot -->
				<div class="flex flex-col gap-2">
					<span class="text-xs uppercase tracking-[0.2em] text-muted-foreground">
						Tým ({players.length})
					</span>
					<ul class="flex flex-col gap-2">
						{#each sortedPlayers(players) as p (p.id)}
							{@const pMax = maxInfectionStage(p.infection_levels)}
							<li
								class={[
									'flex items-center gap-3 rounded-lg border border-border/40 bg-card/50 px-3 py-2',
									p.id === myPlayer.id ? 'ring-1 ring-primary' : ''
								].join(' ')}
							>
								<div
									class="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium uppercase tracking-wider"
								>
									{initials(p.display_name)}
								</div>
								<div class="flex min-w-0 flex-1 flex-col">
									<span class="truncate text-sm font-medium">
										{p.display_name}
									</span>
									<span class="truncate text-xs text-muted-foreground">
										{roleLabel(p.role)}
									</span>
								</div>
								{#if pMax > 0}
									<span
										class="size-2.5 shrink-0 rounded-full"
										style={`background-color: ${dotColor(
											(['rubra', 'viridis', 'nox', 'aurum'] as DiseaseKey[]).find(
												(k) => infectionStage(p.infection_levels, k) === pMax
											) ?? 'rubra'
										)};`}
										aria-label={`Stupeň ${pMax}`}
									></span>
								{:else}
									<span
										class="size-2.5 shrink-0 rounded-full bg-stage-safe/70"
										aria-label="Zdravý"
									></span>
								{/if}
							</li>
						{/each}
					</ul>
				</div>

				<!-- Cities count, just for context -->
				{#if cities.length > 0}
					<p class="text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
						{cities.length} měst · fáze {game.current_phase ? PHASE_LABELS[game.current_phase] : '—'}
					</p>
				{/if}
			</section>
		{/if}
	</div>

	{#if toastMessage}
		<div
			class="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center px-4"
			role="status"
			aria-live="polite"
		>
			<div
				class="pointer-events-auto rounded-md border border-border/60 bg-background/95 px-3 py-2 text-xs shadow-md backdrop-blur"
			>
				{toastMessage}
			</div>
		</div>
	{/if}

	{#if sessionChecked && myPlayer && game.status === 'active'}
		<div
			class="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center bg-gradient-to-t from-background via-background/80 to-transparent px-4 pb-6 pt-10"
		>
			<Button
				variant="destructive"
				class="pointer-events-auto h-12 w-full max-w-md text-base font-semibold shadow-lg"
				onclick={handleSos}
			>
				<LifeBuoy class="size-5" />
				SOS — potřebuju pomoc
			</Button>
		</div>
	{/if}
</div>
