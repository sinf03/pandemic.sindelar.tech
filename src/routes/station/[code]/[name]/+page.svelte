<script lang="ts">
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import { stationApi, GameApiError } from '$lib/api';
	import { getBrowserSupabase } from '$lib/supabase/client';
	import { answerMatches, type Station, type AnsweredTask, type SimpleTask } from '$lib/stations';
	import { DISEASE_KEYS, DISEASE_THEMES, type DiseaseTheme } from '$lib/game/constants';
	import type {
		DiseaseKey,
		DiseaseRow,
		GameRow,
		PlayerRow
	} from '$lib/supabase/types';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import BrandMark from '$lib/components/game/BrandMark.svelte';
	import { CheckCircle2, RefreshCw, FlaskConical, Brain, Sparkles, Footprints, Heart, Eye, EyeOff } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	const initial = untrack(() => data.initial);
	const station: Station = untrack(() => data.station);

	const code = $derived((page.params.code ?? '').toUpperCase());
	const token = $derived(page.url.searchParams.get('token') ?? '');
	const reveal = $derived(page.url.searchParams.get('reveal') === '1');

	let game = $state<GameRow>(initial.game);
	let players = $state<PlayerRow[]>(initial.players);
	let diseases = $state<DiseaseRow[]>(initial.diseases);

	let taskIndex = $state(Math.floor(Math.random() * station.tasks.length));
	let answerInput = $state('');
	let answerWrong = $state(false);
	let busy = $state(false);
	let confirmed = $state(false);
	let errorMessage = $state<string | null>(null);

	// Karanténa picker state — only used when station.key === 'karantena'
	let pickedPlayerId = $state<string | null>(null);
	let pickedDisease = $state<DiseaseKey | null>(null);

	const task = $derived(station.tasks[taskIndex] as SimpleTask | AnsweredTask);
	const isAnswered = $derived(station.key === 'centrala');
	const isKarantena = $derived(station.key === 'karantena');

	const theme = $derived.by<DiseaseTheme>(() => {
		const t = (game.settings as { theme?: DiseaseTheme } | null)?.theme;
		return t === 'scout' ? 'scout' : 'clinical';
	});
	const diseaseLabels = $derived(DISEASE_THEMES[theme]);

	const cureDisease = $derived(
		station.key !== 'karantena' ? station.disease : null
	);
	const cureDiseaseState = $derived(
		cureDisease ? diseases.find((d) => d.key === cureDisease) ?? null : null
	);

	const StationIcon = $derived(
		station.key === 'lab'
			? FlaskConical
			: station.key === 'centrala'
				? Brain
				: station.key === 'sklad'
					? Sparkles
					: station.key === 'pole'
						? Footprints
						: Heart
	);

	const eligiblePlayers = $derived(
		players.filter((p) => !p.is_admin).sort((a, b) => a.slot_index - b.slot_index)
	);
	const pickedPlayer = $derived(
		pickedPlayerId ? players.find((p) => p.id === pickedPlayerId) ?? null : null
	);

	function diseaseStageForPlayer(p: PlayerRow | null, k: DiseaseKey): number {
		if (!p) return 0;
		const raw = p.infection_levels;
		if (typeof raw !== 'object' || raw === null) return 0;
		const v = (raw as Record<string, unknown>)[k];
		return typeof v === 'number' ? Math.max(0, Math.min(3, Math.round(v))) : 0;
	}

	function nextTask() {
		const candidates = station.tasks.length;
		if (candidates <= 1) return;
		let next = taskIndex;
		while (next === taskIndex) {
			next = Math.floor(Math.random() * candidates);
		}
		taskIndex = next;
		answerInput = '';
		answerWrong = false;
		confirmed = false;
		errorMessage = null;
	}

	async function submit() {
		if (busy) return;
		errorMessage = null;
		answerWrong = false;

		if (!token) {
			errorMessage = 'Stanice nemá token vedoucího. Otevři ji znovu z admin panelu.';
			return;
		}
		if (game.status !== 'active') {
			errorMessage = 'Hra není aktivní. Stanice nereaguje, dokud vedoucí hru nespustí.';
			return;
		}

		if (isAnswered) {
			const t = task as AnsweredTask;
			if (!answerMatches(answerInput, t.answer)) {
				answerWrong = true;
				return;
			}
		}

		if (isKarantena) {
			if (!pickedPlayerId) {
				errorMessage = 'Vyber hráče, kterého léčíš.';
				return;
			}
			if (!pickedDisease) {
				errorMessage = 'Vyber nemoc, ze které ho léčíš.';
				return;
			}
			if (diseaseStageForPlayer(pickedPlayer, pickedDisease) === 0) {
				errorMessage = 'Tato nemoc už je u hráče na stupni 0 — není co léčit.';
				return;
			}
		}

		if (!isKarantena && cureDiseaseState?.cured) {
			errorMessage = 'Lék pro tuto nemoc je už hotov.';
			return;
		}

		busy = true;
		try {
			await stationApi.stationComplete(code, token, {
				station: station.key,
				task_label: task.title,
				player_id: isKarantena ? pickedPlayerId ?? undefined : undefined,
				disease: isKarantena ? pickedDisease ?? undefined : undefined
			});
			confirmed = true;
			setTimeout(() => {
				confirmed = false;
				nextTask();
				pickedPlayerId = null;
				pickedDisease = null;
			}, 2500);
		} catch (e) {
			errorMessage = e instanceof GameApiError ? e.message : (e as Error).message;
		} finally {
			busy = false;
		}
	}

	// Realtime: keep game / players / diseases fresh
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

		const channel = supabase
			.channel('station:' + gameId)
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

	<div class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-6 md:py-10">
		<header class="flex flex-wrap items-start justify-between gap-4">
			<div class="flex items-start gap-4">
				<a href="/" aria-label="Domů" class="shrink-0">
					<BrandMark size={56} class="rounded-md" />
				</a>
				<div class="flex flex-col gap-1">
					<span class="text-xs uppercase tracking-[0.22em] text-muted-foreground">
						Stanice · {code}
					</span>
					<h1 class="flex items-center gap-3 text-3xl font-semibold tracking-tight md:text-4xl">
						<StationIcon class={`size-7 text-${station.accent}`} />
						{station.name}
					</h1>
					<p class="max-w-prose text-sm text-muted-foreground">{station.subtitle}</p>
				</div>
			</div>
			<div class="flex flex-col items-end gap-1 text-right">
				{#if cureDisease && cureDiseaseState}
					<span class="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
						Lék pro {diseaseLabels[cureDisease]}
					</span>
					<span class="font-mono text-2xl tabular-nums">
						{cureDiseaseState.cure_stage}/4
					</span>
					{#if cureDiseaseState.cured}
						<Badge variant="default" class="bg-viridis/20 text-viridis">Vyléčeno</Badge>
					{/if}
				{/if}
			</div>
		</header>

		{#if !token}
			<div
				role="alert"
				class="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
			>
				Stanice potřebuje token vedoucího v URL (<code>?token=…</code>). Otevři ji z admin panelu.
			</div>
		{/if}

		{#if errorMessage}
			<div
				role="alert"
				class="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
			>
				{errorMessage}
			</div>
		{/if}

		<Card class="bg-card/60">
			<CardHeader>
				<CardTitle class="flex items-center justify-between gap-3">
					<span class="text-xs uppercase tracking-[0.22em] text-muted-foreground">
						Úkol {taskIndex + 1} z {station.tasks.length}
					</span>
					<Button variant="ghost" size="sm" onclick={nextTask} disabled={busy}>
						<RefreshCw class="size-4" />
						Jiný úkol
					</Button>
				</CardTitle>
			</CardHeader>
			<CardContent class="flex flex-col gap-4">
				<h2 class="text-2xl font-semibold leading-tight tracking-tight md:text-3xl">
					{task.title}
				</h2>
				<p class="text-base text-foreground/85">
					{task.body}
				</p>

				{#if isAnswered}
					{@const t = task as AnsweredTask}
					<div class="flex flex-col gap-2">
						<label class="text-xs uppercase tracking-[0.22em] text-muted-foreground" for="answer">
							Odpověď
						</label>
						<Input
							id="answer"
							placeholder="Sem napiš svoje řešení…"
							bind:value={answerInput}
							onkeydown={(e: KeyboardEvent) => {
								if (e.key === 'Enter') submit();
							}}
							class="text-lg"
						/>
						{#if answerWrong}
							<span class="text-sm text-destructive">
								Špatně. Zkus znovu nebo dej „Jiný úkol".
							</span>
						{/if}
						{#if reveal}
							<div class="flex items-center gap-2 rounded-md border border-dashed border-border/60 bg-card/40 px-3 py-2 text-xs">
								<Eye class="size-3.5 text-muted-foreground" />
								<span class="text-muted-foreground">Klíč vedoucího:</span>
								<code class="font-mono">{t.answer}</code>
								{#if t.hint}
									<span class="ml-2 text-muted-foreground">— {t.hint}</span>
								{/if}
							</div>
						{/if}
					</div>
				{/if}

				{#if isKarantena}
					<div class="grid gap-3 sm:grid-cols-2">
						<label class="flex flex-col gap-1 text-xs">
							<span class="text-muted-foreground uppercase tracking-[0.18em]">Hráč</span>
							<select
								bind:value={pickedPlayerId}
								class="h-10 rounded-md border border-border bg-background px-3 text-base"
							>
								<option value={null}>— Vyber hráče —</option>
								{#each eligiblePlayers as p (p.id)}
									<option value={p.id}>{p.display_name}</option>
								{/each}
							</select>
						</label>
						<label class="flex flex-col gap-1 text-xs">
							<span class="text-muted-foreground uppercase tracking-[0.18em]">Nemoc k vyléčení</span>
							<select
								bind:value={pickedDisease}
								class="h-10 rounded-md border border-border bg-background px-3 text-base"
							>
								<option value={null}>— Vyber nemoc —</option>
								{#each DISEASE_KEYS as k (k)}
									{@const stage = diseaseStageForPlayer(pickedPlayer, k)}
									<option value={k} disabled={stage === 0}>
										{diseaseLabels[k]} ({stage}/3)
									</option>
								{/each}
							</select>
						</label>
					</div>
				{/if}

				<div class="flex flex-wrap items-center gap-3 pt-2">
					<Button
						variant="default"
						size="lg"
						onclick={submit}
						disabled={busy || confirmed || !token || game.status !== 'active' || (!isKarantena && cureDiseaseState?.cured)}
						class="min-w-40 text-base"
					>
						<CheckCircle2 class="size-5" />
						{isAnswered ? 'Odeslat odpověď' : 'Hotovo'}
					</Button>
					{#if confirmed}
						<span class="flex items-center gap-2 text-sm text-viridis">
							<CheckCircle2 class="size-4" />
							{isKarantena
								? 'Zaznamenáno — hráč o stupeň vyléčen.'
								: 'Zaznamenáno — vedoucí dostal posun.'}
						</span>
					{:else if game.status !== 'active'}
						<span class="text-sm text-muted-foreground">
							{game.status === 'lobby'
								? 'Hra ještě nezačala.'
								: game.status === 'paused'
									? 'Hra je pauznutá.'
									: 'Hra skončila.'}
						</span>
					{:else if !isKarantena && cureDiseaseState?.cured}
						<span class="text-sm text-viridis">Lék hotov — stanice tu nemá co dělat.</span>
					{/if}
				</div>
			</CardContent>
		</Card>

		<aside class="flex flex-col gap-2">
			<span class="text-xs uppercase tracking-[0.22em] text-muted-foreground">
				Stav hry
			</span>
			<div class="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
				<span>Kód: <code class="font-mono">{code}</code></span>
				<span>Kolo: {game.current_round}</span>
				<span>Fáze: {game.current_phase ?? '—'}</span>
				<span>{players.length} hráčů</span>
				{#if reveal}
					<a
						href={page.url.pathname + `?token=${token}`}
						class="ml-auto inline-flex items-center gap-1 text-xs underline underline-offset-4 hover:text-foreground"
					>
						<EyeOff class="size-3" /> Skrýt klíč
					</a>
				{:else if isAnswered}
					<a
						href={page.url.pathname + `?token=${token}&reveal=1`}
						class="ml-auto inline-flex items-center gap-1 text-xs underline underline-offset-4 hover:text-foreground"
					>
						<Eye class="size-3" /> Klíč pro vedoucího
					</a>
				{/if}
			</div>
		</aside>
	</div>
</div>
