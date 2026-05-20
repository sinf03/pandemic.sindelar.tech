<script lang="ts">
	import type { GameCityRow, DiseaseKey } from '$lib/supabase/types';
	import { maxInfectionStage, infectionStage } from '$lib/game/load';

	let {
		city,
		selected = false,
		onclick
	}: {
		city: GameCityRow;
		selected?: boolean;
		onclick?: () => void;
	} = $props();

	const VIEW_W = 1000;
	const VIEW_H = 700;

	const cx = $derived(city.x * VIEW_W);
	const cy = $derived(city.y * VIEW_H);

	const colorKey = $derived(city.color_token as DiseaseKey);
	const stage = $derived(maxInfectionStage(city.infection_levels));

	const ORDER: DiseaseKey[] = ['rubra', 'viridis', 'nox', 'aurum'];

	function ringRadius(i: number) {
		return 10 + i * 3.5;
	}

	function ringOpacity(s: number) {
		if (s <= 0) return 0;
		if (s === 1) return 0.45;
		if (s === 2) return 0.7;
		return 1;
	}

	function handleKey(e: KeyboardEvent) {
		if (!onclick) return;
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onclick();
		}
	}
</script>

{#snippet body()}
	{#each ORDER as key, idx (key)}
		{@const s = infectionStage(city.infection_levels, key)}
		{#if s > 0}
			<circle
				cx="0"
				cy="0"
				r={ringRadius(idx)}
				fill="none"
				stroke={`var(--${key})`}
				stroke-opacity={ringOpacity(s)}
				stroke-width={1.6}
			/>
		{/if}
	{/each}

	{#if selected}
		<circle
			cx="0"
			cy="0"
			r="14"
			fill="none"
			stroke="var(--primary)"
			stroke-width="1.5"
			stroke-dasharray="3 3"
		/>
	{/if}

	<circle
		cx="0"
		cy="0"
		r="7"
		fill={`var(--${colorKey})`}
		stroke="var(--background)"
		stroke-width="1.5"
		opacity={stage >= 3 ? 1 : 0.92}
	/>

	{#if city.has_station}
		<g transform="translate(8, -14)" aria-hidden="true">
			<rect
				x="0"
				y="2"
				width="8"
				height="6"
				fill="var(--foreground)"
				stroke="var(--background)"
				stroke-width="0.6"
				rx="0.5"
			/>
			<polygon
				points="0,2 4,-2 8,2"
				fill="var(--foreground)"
				stroke="var(--background)"
				stroke-width="0.6"
				stroke-linejoin="round"
			/>
		</g>
	{/if}

	<text
		x="0"
		y="22"
		text-anchor="middle"
		fill="currentColor"
		font-size="11"
		font-family="var(--font-sans)"
		style="paint-order: stroke fill;"
		stroke="var(--background)"
		stroke-width="2.5"
		stroke-opacity="0.85"
		stroke-linejoin="round"
	>
		{city.name}
	</text>
{/snippet}

{#if onclick}
	<g
		class="cursor-pointer transition-transform"
		transform={`translate(${cx}, ${cy})`}
		role="button"
		tabindex="0"
		aria-label={city.name}
		onclick={onclick}
		onkeydown={handleKey}
	>
		{@render body()}
	</g>
{:else}
	<g class="transition-transform" transform={`translate(${cx}, ${cy})`}>
		{@render body()}
	</g>
{/if}
