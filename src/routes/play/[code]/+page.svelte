<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { PageData } from './$types';
	import { getBrowserSupabase } from '$lib/supabase/client';
	import { loadSession, type PlayerSession } from '$lib/session';
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
		PlayerRole
	} from '$lib/supabase/types';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import RoleCard from '$lib/components/game/RoleCard.svelte';
	import PhaseTimer from '$lib/components/game/PhaseTimer.svelte';
	import InfectionRing from '$lib/components/game/InfectionRing.svelte';
	import { LifeBuoy, Hourglass } from 'lucide-svelte';
	import { untrack } from 'svelte';

	let { data }: { data: PageData } = $props();

	const code = $derived((page.params.code ?? '').toUpperCase());

	// Snapshot the SSR payload once. Subsequent updates come via realtime.
	const initial = untrack(() => data.initial);

	let game = $state<GameRow>(initial.game);
	let players = $state<PlayerRow[]>(initial.players);
	let diseases = $state<DiseaseRow[]>(initial.diseases);
	let cities = $state<GameCityRow[]>(initial.cities);

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
					// Crisis draws don't have their own slice; downstream views may want them.
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	});

	function handleSos() {
		console.log('SOS');
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

				<!-- Diseases summary for context -->
				{#if diseases.length > 0}
					<Card class="bg-card/40">
						<CardContent class="flex flex-col gap-2 py-3">
							<span class="text-xs uppercase tracking-[0.2em] text-muted-foreground">
								Nemoci v hře
							</span>
							<div class="flex flex-wrap gap-1.5">
								{#each diseases as d (d.id)}
									<Badge
										variant="default"
										class={`${diseaseBadgeClass(d.key, 1)} ${d.cured ? 'opacity-50 line-through' : ''}`}
									>
										{d.name} · {d.cure_stage}/4
									</Badge>
								{/each}
							</div>
						</CardContent>
					</Card>
				{/if}

				<!-- Cities count, just for context -->
				{#if cities.length > 0}
					<p class="text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
						{cities.length} měst · fáze {game.current_phase ? PHASE_LABELS[game.current_phase] : '—'}
					</p>
				{/if}
			</section>
		{/if}
	</div>

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
