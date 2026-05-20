<script lang="ts">
	import type { GameCityRow, MapRow, MapPayload } from '$lib/supabase/types';
	import CityNode from './CityNode.svelte';

	let {
		map,
		cities,
		width,
		height,
		selectedCityId = null,
		onCityClick
	}: {
		map: MapRow & { payload: MapPayload };
		cities: GameCityRow[];
		width?: number;
		height?: number;
		selectedCityId?: string | null;
		onCityClick?: (city: GameCityRow) => void;
	} = $props();

	const VIEW_W = 1000;
	const VIEW_H = 700;

	// Lookup from map_city_key -> normalized x,y, used to draw edges
	// even when game_cities rows don't exist yet (lobby state).
	const payloadCityByKey = $derived.by(() => {
		const m: Record<string, { x: number; y: number }> = {};
		for (const c of map.payload.cities) {
			m[c.id] = { x: c.x, y: c.y };
		}
		return m;
	});

	const edges = $derived(
		map.payload.edges
			.map(([a, b]) => {
				const pa = payloadCityByKey[a];
				const pb = payloadCityByKey[b];
				if (!pa || !pb) return null;
				return {
					key: `${a}__${b}`,
					x1: pa.x * VIEW_W,
					y1: pa.y * VIEW_H,
					x2: pb.x * VIEW_W,
					y2: pb.y * VIEW_H
				};
			})
			.filter((e): e is { key: string; x1: number; y1: number; x2: number; y2: number } => !!e)
	);
</script>

<svg
	viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
	preserveAspectRatio="xMidYMid meet"
	width={width ?? '100%'}
	height={height ?? '100%'}
	role="img"
	aria-label="Mapa měst"
	class="block h-full w-full text-foreground"
>
	<g aria-hidden="true">
		{#each edges as e (e.key)}
			<line
				x1={e.x1}
				y1={e.y1}
				x2={e.x2}
				y2={e.y2}
				stroke="var(--color-border)"
				stroke-width="1.2"
				stroke-opacity="0.55"
			/>
		{/each}
	</g>

	<g>
		{#each cities as city (city.id)}
			<CityNode
				{city}
				selected={selectedCityId === city.id}
				onclick={onCityClick ? () => onCityClick(city) : undefined}
			/>
		{/each}
	</g>
</svg>
