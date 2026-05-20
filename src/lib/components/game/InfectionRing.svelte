<script lang="ts">
	import type { DiseaseKey } from '$lib/supabase/types';

	type Stages = Record<DiseaseKey, number>;

	let {
		stages,
		size = 28
	}: {
		stages: Stages;
		size?: number;
	} = $props();

	const ORDER: DiseaseKey[] = ['rubra', 'viridis', 'nox', 'aurum'];

	const total = $derived(stages.rubra + stages.viridis + stages.nox + stages.aurum);
	const center = $derived(size / 2);
	// Each ring is drawn as a stroked circle at decreasing radius.
	function radiusFor(idx: number) {
		// outer = size/2 - 2, each ring 3px thinner
		return size / 2 - 2 - idx * 3.2;
	}

	function strokeOpacity(stage: number) {
		// stage 0 = invisible, 1 = 0.4, 2 = 0.7, 3 = 1.0
		if (stage <= 0) return 0;
		if (stage === 1) return 0.45;
		if (stage === 2) return 0.75;
		return 1;
	}

	function strokeWidth(stage: number) {
		if (stage <= 0) return 0;
		if (stage === 1) return 1.2;
		if (stage === 2) return 1.8;
		return 2.4;
	}
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 {size} {size}"
	role="img"
	aria-label="Stupně nákazy"
	class="inline-block shrink-0"
>
	{#if total === 0}
		<circle
			cx={center}
			cy={center}
			r={size / 2 - 1.5}
			fill="none"
			stroke="currentColor"
			stroke-opacity="0.25"
			stroke-width="1"
		/>
	{:else}
		{#each ORDER as key, idx (key)}
			{@const stage = stages[key]}
			{#if stage > 0}
				<circle
					cx={center}
					cy={center}
					r={radiusFor(idx)}
					fill="none"
					stroke={`var(--${key})`}
					stroke-opacity={strokeOpacity(stage)}
					stroke-width={strokeWidth(stage)}
				/>
			{/if}
		{/each}
	{/if}
</svg>
