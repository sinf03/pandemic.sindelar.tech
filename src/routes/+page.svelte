<script lang="ts">
	import { onMount } from 'svelte';
	import { LogIn, Plus, ArrowRight } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { listSessions, type PlayerSession } from '$lib/session';
	import logo from '$lib/assets/logo.png';

	let sessions = $state<PlayerSession[]>([]);

	onMount(() => {
		sessions = listSessions();
	});
</script>

<div class="relative min-h-screen overflow-hidden bg-background text-foreground">
	<div
		class="absolute inset-0 -z-10 opacity-20 [background:radial-gradient(circle_at_1px_1px,theme(colors.foreground/0.12)_1px,transparent_0)] [background-size:24px_24px]"
	></div>
	<div
		class="pointer-events-none absolute left-1/2 top-[-180px] -z-10 size-[520px] -translate-x-1/2 rounded-full bg-rubra/15 blur-[110px]"
		aria-hidden="true"
	></div>

	<div class="mx-auto flex max-w-4xl flex-col gap-14 px-6 py-12 md:py-20">
		<header class="flex flex-col items-center gap-6 text-center md:items-start md:text-left">
			<img
				src={logo}
				alt="Znak Krizového štábu — pandemic & skautská lilie"
				width="220"
				height="220"
				class="size-36 select-none md:size-48 drop-shadow-[0_18px_40px_rgba(220,38,38,0.25)]"
				draggable="false"
			/>
			<div class="flex flex-col gap-3">
				<span class="text-xs uppercase tracking-[0.22em] text-muted-foreground">
					Hra pro skautské oddíly
				</span>
				<h1 class="text-5xl font-semibold tracking-tight md:text-7xl">
					PANDEMIC: <span class="text-rubra">Krizový štáb</span>
				</h1>
				<p class="max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
					Hybridní krizová simulace pro tým ~7 hráčů. Telefony v rukou, mapa na projektoru, akce v
					lese.
				</p>
			</div>
		</header>

		<section class="grid gap-4 md:grid-cols-2">
			<Card class="bg-card/60 backdrop-blur transition-colors hover:bg-card">
				<CardContent class="flex h-full flex-col gap-4 py-6">
					<div class="flex items-center gap-3">
						<div
							class="flex size-10 items-center justify-center rounded-lg border border-border bg-background/60"
						>
							<LogIn class="size-5 text-foreground" />
						</div>
						<h2 class="text-lg font-semibold tracking-tight">Připojit se ke hře</h2>
					</div>
					<p class="text-sm text-muted-foreground">
						Mám kód od vedoucího a chci do týmu.
					</p>
					<div class="mt-auto pt-2">
						<Button variant="outline" href="/join" class="w-full md:w-auto">
							Zadat kód
							<ArrowRight class="size-4" />
						</Button>
					</div>
				</CardContent>
			</Card>

			<Card class="bg-card/60 backdrop-blur transition-colors hover:bg-card">
				<CardContent class="flex h-full flex-col gap-4 py-6">
					<div class="flex items-center gap-3">
						<div
							class="flex size-10 items-center justify-center rounded-lg bg-rubra/15 text-rubra"
						>
							<Plus class="size-5" />
						</div>
						<h2 class="text-lg font-semibold tracking-tight">Vytvořit novou hru</h2>
					</div>
					<p class="text-sm text-muted-foreground">
						Jsem vedoucí a chci rozjet novou krizi.
					</p>
					<div class="mt-auto pt-2">
						<Button variant="default" href="/new" class="w-full md:w-auto">
							Založit štáb
							<ArrowRight class="size-4" />
						</Button>
					</div>
				</CardContent>
			</Card>
		</section>

		{#if sessions.length > 0}
			<section class="flex flex-col gap-4">
				<div class="flex items-baseline justify-between">
					<h2 class="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pokračovat</h2>
					<span class="text-xs text-muted-foreground">{sessions.length}</span>
				</div>
				<div class="grid gap-3">
					{#each sessions as session (session.game_code)}
						<a
							href={`/play/${session.game_code}`}
							class="group block rounded-xl border border-border bg-card/40 px-4 py-3 transition-colors hover:bg-card"
						>
							<div class="flex items-center justify-between gap-4">
								<div class="flex min-w-0 flex-col">
									<span class="truncate text-sm font-medium">
										{session.display_name}
									</span>
									<span class="font-mono text-xs uppercase tracking-widest text-muted-foreground">
										{session.game_code}
									</span>
								</div>
								<ArrowRight
									class="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
								/>
							</div>
						</a>
					{/each}
				</div>
			</section>
		{/if}
	</div>
</div>
