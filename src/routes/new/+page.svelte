<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { getBrowserSupabase } from '$lib/supabase/client';
	import { saveSession } from '$lib/session';
	import { DEFAULT_SETTINGS, type DiseaseTheme } from '$lib/game/constants';
	import { ArrowRight, Map } from 'lucide-svelte';

	const DEFAULT_MAP_ID = '00000000-0000-0000-0000-000000000001';

	let leaderName = $state('');
	let theme = $state<DiseaseTheme>('clinical');
	let submitting = $state(false);
	let errorMessage = $state<string | null>(null);

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (submitting) return;
		errorMessage = null;

		const trimmedName = leaderName.trim();
		if (!trimmedName) {
			errorMessage = 'Zadej svoje jméno.';
			return;
		}

		submitting = true;
		try {
			const supabase = getBrowserSupabase();
			const { data, error } = await supabase.rpc('create_new_game', {
				p_map_id: DEFAULT_MAP_ID,
				p_settings: { ...DEFAULT_SETTINGS, theme },
				p_leader_name: trimmedName
			});

			if (error) {
				errorMessage = error.message;
				return;
			}

			const result = data as {
				game_id: string;
				game_code: string;
				player_id: string;
				device_token: string;
				display_name: string;
			} | null;

			if (!result) {
				errorMessage = 'Server nevrátil žádná data.';
				return;
			}

			saveSession({
				game_id: result.game_id,
				game_code: result.game_code,
				player_id: result.player_id,
				device_token: result.device_token,
				display_name: result.display_name,
				is_admin: true
			});

			await goto(`/admin/${result.game_code}`);
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Něco se pokazilo.';
		} finally {
			submitting = false;
		}
	}
</script>

<div class="relative min-h-screen overflow-hidden bg-background text-foreground">
	<div
		class="absolute inset-0 -z-10 opacity-20 [background:radial-gradient(circle_at_1px_1px,theme(colors.foreground/0.12)_1px,transparent_0)] [background-size:24px_24px]"
	></div>

	<div class="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
		<header class="mb-8 flex flex-col gap-3">
			<span class="text-xs uppercase tracking-[0.2em] text-muted-foreground">
				Nový krizový štáb
			</span>
			<h1 class="text-4xl font-semibold tracking-tight md:text-5xl">Vytvořit novou hru</h1>
			<p class="text-sm text-muted-foreground">
				Nastavíš pár věcí a dostaneš kód, který předáš týmu.
			</p>
		</header>

		<form onsubmit={onSubmit} class="flex flex-col gap-6">
			<div class="flex flex-col gap-2">
				<Label for="leader-name">Tvoje jméno (vedoucí)</Label>
				<Input
					id="leader-name"
					name="leader-name"
					type="text"
					autocomplete="nickname"
					maxlength={24}
					required
					bind:value={leaderName}
					placeholder="např. Šedý vlk"
					class="h-11"
				/>
			</div>

			<div class="flex flex-col gap-2">
				<span class="text-sm font-medium leading-none">Téma názvů nemocí</span>
				<div
					role="radiogroup"
					aria-label="Téma názvů nemocí"
					class="grid grid-cols-2 gap-1 rounded-lg border border-border bg-card/40 p-1"
				>
					<button
						type="button"
						role="radio"
						aria-checked={theme === 'clinical'}
						onclick={() => (theme = 'clinical')}
						class={[
							'rounded-md px-3 py-2 text-sm font-medium transition-colors',
							theme === 'clinical'
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:text-foreground'
						].join(' ')}
					>
						Klinické názvy
					</button>
					<button
						type="button"
						role="radio"
						aria-checked={theme === 'scout'}
						onclick={() => (theme = 'scout')}
						class={[
							'rounded-md px-3 py-2 text-sm font-medium transition-colors',
							theme === 'scout'
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:text-foreground'
						].join(' ')}
					>
						Skautské názvy
					</button>
				</div>
				<p class="text-xs text-muted-foreground">
					{#if theme === 'clinical'}
						Rubra, Viridis, Nox, Aurum.
					{:else}
						Rudý kašel, Zelená horečka, Černý stín, Zlatá zimnice.
					{/if}
				</p>
			</div>

			<Card class="bg-card/40">
				<CardContent class="flex items-start gap-3 py-4">
					<div
						class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-viridis/15 text-viridis"
					>
						<Map class="size-4" />
					</div>
					<div class="flex flex-col gap-1">
						<span class="text-sm font-medium">Mapa: Česko 20</span>
						<span class="text-xs text-muted-foreground">
							Výchozí předloha s 20 českými městy. Další mapy přidáš později v adminu.
						</span>
					</div>
				</CardContent>
			</Card>

			{#if errorMessage}
				<div
					role="alert"
					class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
				>
					{errorMessage}
				</div>
			{/if}

			<Button type="submit" variant="default" disabled={submitting} class="h-11 w-full">
				{submitting ? 'Zakládám hru…' : 'Vytvořit hru'}
				{#if !submitting}
					<ArrowRight class="size-4" />
				{/if}
			</Button>

			<a
				href="/"
				class="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
			>
				Zpět
			</a>
		</form>
	</div>
</div>
