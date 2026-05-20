<script lang="ts">
	import type { PlayerRole } from '$lib/supabase/types';
	import { ROLE_LABELS } from '$lib/game/constants';
	import { Card, CardContent } from '$lib/components/ui/card';
	import {
		Crown,
		Eye,
		HeartPulse,
		Backpack,
		FlaskConical,
		Footprints,
		Wrench,
		UserRound
	} from 'lucide-svelte';

	let { role }: { role: PlayerRole | null } = $props();

	const ICONS: Record<PlayerRole, typeof Crown> = {
		koordinator: Crown,
		epidemiolog: Eye,
		medik: HeartPulse,
		logistik: Backpack,
		vyzkumnik: FlaskConical,
		spojka_a: Footprints,
		spojka_b: Footprints,
		technik: Wrench
	};

	const ACCENTS: Record<PlayerRole, string> = {
		koordinator: 'bg-aurum/15 text-aurum',
		epidemiolog: 'bg-viridis/15 text-viridis',
		medik: 'bg-rubra/15 text-rubra',
		logistik: 'bg-nox/15 text-nox',
		vyzkumnik: 'bg-viridis/15 text-viridis',
		spojka_a: 'bg-aurum/15 text-aurum',
		spojka_b: 'bg-aurum/15 text-aurum',
		technik: 'bg-nox/15 text-nox'
	};

	const Icon = $derived(role ? ICONS[role] : UserRound);
	const accent = $derived(role ? ACCENTS[role] : 'bg-muted text-muted-foreground');
</script>

<Card class="bg-card/60 backdrop-blur">
	<CardContent class="flex items-start gap-4 py-5">
		<div
			class={`flex size-12 shrink-0 items-center justify-center rounded-xl ${accent}`}
		>
			<Icon class="size-5" />
		</div>
		{#if role}
			<div class="flex min-w-0 flex-col gap-1">
				<span class="text-xs uppercase tracking-[0.18em] text-muted-foreground">
					Tvoje role
				</span>
				<span class="text-lg font-semibold leading-tight">
					{ROLE_LABELS[role].name}
				</span>
				<p class="text-sm text-muted-foreground">
					{ROLE_LABELS[role].ability}
				</p>
			</div>
		{:else}
			<div class="flex min-w-0 flex-col gap-1">
				<span class="text-xs uppercase tracking-[0.18em] text-muted-foreground">
					Tvoje role
				</span>
				<span class="text-lg font-semibold leading-tight">Role bude přidělena</span>
				<p class="text-sm text-muted-foreground">
					Vedoucí ti přidělí roli, než hra začne.
				</p>
			</div>
		{/if}
	</CardContent>
</Card>
