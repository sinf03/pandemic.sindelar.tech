<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { getBrowserSupabase } from '$lib/supabase/client';
	import { saveSession } from '$lib/session';
	import BrandMark from '$lib/components/game/BrandMark.svelte';
	import { ArrowRight } from 'lucide-svelte';

	let code = $state((page.url.searchParams.get('code') ?? '').toUpperCase().slice(0, 6));
	let displayName = $state('');
	let submitting = $state(false);
	let errorMessage = $state<string | null>(null);

	function onCodeInput(event: Event & { currentTarget: HTMLInputElement }) {
		const next = event.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
		code = next;
		event.currentTarget.value = next;
	}

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (submitting) return;
		errorMessage = null;

		const trimmedName = displayName.trim();
		if (code.length !== 6) {
			errorMessage = 'Kód musí mít 6 znaků.';
			return;
		}
		if (!trimmedName) {
			errorMessage = 'Zadej svoje jméno.';
			return;
		}

		submitting = true;
		try {
			const supabase = getBrowserSupabase();
			const { data, error } = await supabase.rpc('claim_player_slot', {
				p_code: code,
				p_display_name: trimmedName
			});

			if (error) {
				errorMessage = error.message;
				return;
			}

			const result = data as {
				game_id: string;
				code: string;
				player_id: string;
				device_token: string;
				slot_index: number;
			} | null;

			if (!result || !result.code) {
				errorMessage = 'Server nevrátil žádná data.';
				return;
			}

			saveSession({
				game_id: result.game_id,
				game_code: result.code,
				player_id: result.player_id,
				device_token: result.device_token,
				display_name: trimmedName,
				is_admin: false
			});

			await goto(`/play/${result.code}`);
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
		<header class="mb-8 flex flex-col gap-4">
			<a href="/" aria-label="Domů" class="-ml-2 inline-flex w-fit p-2">
				<BrandMark size={56} />
			</a>
			<span class="text-xs uppercase tracking-[0.2em] text-muted-foreground">
				Krok 1 z 1
			</span>
			<h1 class="text-4xl font-semibold tracking-tight md:text-5xl">Připojit se ke hře</h1>
			<p class="text-sm text-muted-foreground">
				Zadej kód, který ti dal vedoucí, a tvoje jméno pro tým.
			</p>
		</header>

		<form onsubmit={onSubmit} class="flex flex-col gap-6">
			<div class="flex flex-col gap-2">
				<Label for="code">Kód hry</Label>
				<Input
					id="code"
					name="code"
					autocomplete="off"
					autocapitalize="characters"
					inputmode="text"
					spellcheck={false}
					maxlength={6}
					required
					bind:value={code}
					oninput={onCodeInput}
					placeholder="ABC123"
					class="h-14 text-center font-mono text-2xl tracking-widest uppercase"
				/>
			</div>

			<div class="flex flex-col gap-2">
				<Label for="display-name">Tvoje jméno</Label>
				<Input
					id="display-name"
					name="display-name"
					type="text"
					autocomplete="nickname"
					maxlength={24}
					required
					bind:value={displayName}
					placeholder="např. Bobr"
					class="h-11"
				/>
			</div>

			{#if errorMessage}
				<div
					role="alert"
					class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
				>
					{errorMessage}
				</div>
			{/if}

			<Button type="submit" variant="default" disabled={submitting} class="h-11 w-full">
				{submitting ? 'Připojuji…' : 'Vstoupit do týmu'}
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
