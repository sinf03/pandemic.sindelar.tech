<script lang="ts">
	import type { GamePhase } from '$lib/supabase/types';
	import { PHASE_LABELS } from '$lib/game/constants';

	let {
		phase,
		endsAt
	}: {
		phase: GamePhase | null;
		endsAt: string | null;
	} = $props();

	let now = $state(Date.now());

	$effect(() => {
		if (!endsAt) return;
		const id = setInterval(() => {
			now = Date.now();
		}, 250);
		return () => {
			clearInterval(id);
		};
	});

	const remainingMs = $derived.by(() => {
		if (!endsAt) return null;
		const end = new Date(endsAt).getTime();
		if (Number.isNaN(end)) return null;
		return Math.max(0, end - now);
	});

	const display = $derived.by(() => {
		if (remainingMs === null) return '—';
		const total = Math.ceil(remainingMs / 1000);
		const m = Math.floor(total / 60)
			.toString()
			.padStart(2, '0');
		const s = (total % 60).toString().padStart(2, '0');
		return `${m}:${s}`;
	});

	const expired = $derived(remainingMs !== null && remainingMs <= 0);
</script>

<div class="flex items-center gap-3">
	<div class="flex flex-col items-end">
		<span class="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Fáze</span>
		<span class="text-sm font-medium leading-tight">
			{phase ? PHASE_LABELS[phase] : '—'}
		</span>
	</div>
	<div
		class={[
			'min-w-[5.5rem] rounded-md border border-border/60 bg-background/60 px-3 py-1.5 text-center font-mono text-2xl font-semibold tabular-nums tracking-tight',
			expired ? 'text-muted-foreground' : 'text-foreground'
		].join(' ')}
		aria-label="Zbývající čas"
	>
		{display}
	</div>
</div>
