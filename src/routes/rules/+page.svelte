<script lang="ts">
	import { ArrowLeft, AlertTriangle, Heart, Footprints, Users, Syringe, Vote, Megaphone } from 'lucide-svelte';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import BrandMark from '$lib/components/game/BrandMark.svelte';

	const diseases = [
		{ name: 'Rubra', folk: 'Rudý kašel', color: 'bg-rubra text-rubra-foreground' },
		{ name: 'Viridis', folk: 'Zelená horečka', color: 'bg-viridis text-viridis-foreground' },
		{ name: 'Nox', folk: 'Černý stín', color: 'bg-nox text-nox-foreground' },
		{ name: 'Aurum', folk: 'Zlatá zimnice', color: 'bg-aurum text-aurum-foreground' }
	];

	const stages = [
		{
			stage: 0,
			label: 'Volný pohyb',
			detail: 'Pohybuješ se normálně, můžeš utíkat.',
			tone: 'bg-stage-safe/15 text-stage-safe border-stage-safe/40'
		},
		{
			stage: 1,
			label: 'Jen chůze',
			detail: 'Nesmíš běhat. Choď klidně. (Spojky A/B smí utíkat i na st. 1.)',
			tone: 'bg-stage-1/15 text-stage-1 border-stage-1/40'
		},
		{
			stage: 2,
			label: 'Chůze s omezením',
			detail: 'Choď s rukama za zády nebo s parťákem za ruku (vedoucí určí).',
			tone: 'bg-stage-2/15 text-stage-2 border-stage-2/40'
		},
		{
			stage: 3,
			label: 'Doprovod nutný',
			detail: 'Nemůžeš jít sám. Doprovází tě 1–2 spoluhráči (nikdy tě nezvedají).',
			tone: 'bg-stage-3/15 text-stage-3 border-stage-3/40'
		}
	];

	const roles = [
		{ name: 'Koordinátor', skill: 'Jednou za hru může zrušit špatné týmové rozhodnutí.' },
		{ name: 'Epidemiolog', skill: 'Vidí, která města se nakazí v dalším kole.' },
		{ name: 'Medik', skill: 'Léčí o 2 stupně místo 1.' },
		{ name: 'Logistik', skill: 'Nese 2 zdroje zároveň.' },
		{ name: 'Výzkumník', skill: 'Sleva na vývoj léku.' },
		{ name: 'Spojka A', skill: 'Smí utíkat i při nákaze 1. stupně.' },
		{ name: 'Spojka B', skill: 'Smí utíkat i při nákaze 1. stupně.' },
		{ name: 'Technik', skill: 'Opraví stanici poškozenou krizí.' }
	];

	const phases = [
		{
			n: 1,
			title: 'Porada',
			time: '60 s',
			text: 'Tým se sejde u projektoru, kouká na mapu a plánuje. Telefony v ruce, fyzicky se nehýbete.'
		},
		{
			n: 2,
			title: 'Akce',
			time: '6 minut',
			text: 'Chodíš mezi stanicemi, plníš úkoly: vývoj léku, léčba sebe, hlasování o krizi, SOS.'
		},
		{
			n: 3,
			title: 'Vyhodnocení',
			time: '60 s',
			text: 'Vedoucí ukončuje krize, potvrzuje úlohy, případně losuje novou krizi.'
		},
		{
			n: 4,
			title: 'Šíření',
			time: '≈30 s',
			text: 'Engine náhodně rozhází nákazy do 3 měst. Každé 3. kolo navíc přijde epidemie.'
		}
	];
</script>

<svelte:head>
	<title>Pravidla — PANDEMIC: Krizový štáb</title>
</svelte:head>

<div class="relative min-h-screen overflow-hidden bg-background text-foreground">
	<div
		class="absolute inset-0 -z-10 opacity-20 [background:radial-gradient(circle_at_1px_1px,theme(colors.foreground/0.12)_1px,transparent_0)] [background-size:24px_24px]"
	></div>
	<div
		class="pointer-events-none absolute left-1/2 top-[-180px] -z-10 size-[520px] -translate-x-1/2 rounded-full bg-rubra/15 blur-[110px]"
		aria-hidden="true"
	></div>

	<div class="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-10 md:py-16">
		<header class="flex flex-col gap-5">
			<a
				href="/"
				class="-ml-2 inline-flex w-fit items-center gap-2 p-2 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
			>
				<ArrowLeft class="size-3.5" />
				Domů
			</a>
			<div class="flex items-center gap-4">
				<BrandMark size={64} />
				<div class="flex flex-col gap-1">
					<span class="text-xs uppercase tracking-[0.22em] text-muted-foreground">
						Pravidla pro hráče
					</span>
					<h1 class="text-4xl font-semibold tracking-tight md:text-5xl">
						Krizový <span class="text-rubra">štáb</span>
					</h1>
				</div>
			</div>
			<p class="text-base leading-relaxed text-muted-foreground">
				Hybridní hra inspirovaná deskovce Pandemic. Část se odehrává na telefonu a projektoru,
				část fyzicky v klubovně, na hřišti nebo v lese. Hraje se v <strong>5–8 hráčích</strong> +
				vedoucí.
			</p>
		</header>

		<!-- Cíl hry -->
		<section class="flex flex-col gap-3">
			<h2 class="text-xs uppercase tracking-[0.2em] text-muted-foreground">Cíl hry</h2>
			<Card class="bg-card/60 backdrop-blur">
				<CardContent class="flex flex-col gap-4 py-6">
					<p class="text-base leading-relaxed">
						Vyvinout <strong>lék na všechny 4 nemoci</strong> dřív, než se svět zhroutí.
					</p>
					<div class="grid gap-3 md:grid-cols-2">
						<div class="rounded-lg border border-viridis/30 bg-viridis/10 p-3">
							<div class="text-xs uppercase tracking-widest text-viridis">Vyhráváte když</div>
							<p class="mt-2 text-sm leading-relaxed">
								Vyvinete všechny 4 léky. (Ve striktním módu navíc musí být všechna města čistá.)
							</p>
						</div>
						<div class="rounded-lg border border-rubra/30 bg-rubra/10 p-3">
							<div class="text-xs uppercase tracking-widest text-rubra">Prohráváte když</div>
							<p class="mt-2 text-sm leading-relaxed">
								Pandemický čítač dosáhne <strong>8</strong>, nebo uplyne 12. kolo bez léků.
							</p>
						</div>
					</div>
				</CardContent>
			</Card>
		</section>

		<!-- Nemoci -->
		<section class="flex flex-col gap-3">
			<h2 class="text-xs uppercase tracking-[0.2em] text-muted-foreground">4 nemoci</h2>
			<div class="grid gap-2 sm:grid-cols-2">
				{#each diseases as d (d.name)}
					<div
						class="flex items-center justify-between rounded-xl border border-border bg-card/40 px-4 py-3"
					>
						<div class="flex flex-col">
							<span class="text-sm font-semibold tracking-tight">{d.name}</span>
							<span class="text-xs text-muted-foreground">{d.folk}</span>
						</div>
						<span
							class="rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest {d.color}"
						>
							barva
						</span>
					</div>
				{/each}
			</div>
			<p class="text-xs text-muted-foreground">
				Funkčně jsou všechny 4 nemoci stejné — liší se barvou a chováním v krizových kartách.
			</p>
		</section>

		<!-- Stupně nákazy ve městě -->
		<section class="flex flex-col gap-3">
			<h2 class="text-xs uppercase tracking-[0.2em] text-muted-foreground">
				Stupně nákazy ve městě
			</h2>
			<Card class="bg-card/60 backdrop-blur">
				<CardContent class="flex flex-col gap-3 py-6">
					<ul class="flex flex-col gap-2 text-sm leading-relaxed">
						<li><strong>0</strong> — čisté</li>
						<li><strong>1</strong> — nákaza</li>
						<li><strong>2</strong> — epidemie ve městě</li>
						<li><strong>3</strong> — ohrožení pandemií</li>
					</ul>
					<Separator />
					<p class="text-sm leading-relaxed text-muted-foreground">
						Pokud město na stupni 3 dostane další stupeň téže nemoci, <strong
							>propukne pandemie</strong
						>: pandemický čítač +1 a nemoc se rozšíří do všech sousedních měst řetězově.
					</p>
				</CardContent>
			</Card>
		</section>

		<!-- Vlastní nákaza & pohyb -->
		<section class="flex flex-col gap-3">
			<div class="flex items-center gap-2">
				<Footprints class="size-4 text-rubra" />
				<h2 class="text-xs uppercase tracking-[0.2em] text-muted-foreground">
					Tvoje nákaza a pohyb
				</h2>
			</div>
			<p class="text-sm leading-relaxed text-muted-foreground">
				Každý hráč má vlastní stupeň nákazy (0–3) pro každou nemoc. Stupeň určuje, jak se smíš
				pohybovat ve fyzickém prostoru.
			</p>
			<div class="flex flex-col gap-2">
				{#each stages as s (s.stage)}
					<div
						class="flex items-start gap-3 rounded-xl border bg-card/40 px-4 py-3 {s.tone}"
					>
						<div
							class="flex size-9 shrink-0 items-center justify-center rounded-lg border border-current bg-background/40 text-base font-bold"
						>
							{s.stage}
						</div>
						<div class="flex flex-col gap-0.5">
							<span class="text-sm font-semibold">{s.label}</span>
							<span class="text-xs leading-relaxed opacity-80">{s.detail}</span>
						</div>
					</div>
				{/each}
			</div>

			<div
				role="note"
				class="mt-2 flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3"
			>
				<AlertTriangle class="mt-0.5 size-4 shrink-0 text-destructive" />
				<div class="flex flex-col gap-1 text-sm">
					<span class="font-semibold text-destructive">Tvrdá pravidla bez výjimky</span>
					<span class="text-foreground/80">
						Nikdo nikoho nezvedá. Nikdo neskáče po jedné noze. Nikdo se nedotýká očí cizíma
						rukama. <strong>Bezpečnost &gt; drama.</strong>
					</span>
				</div>
			</div>
		</section>

		<!-- Role -->
		<section class="flex flex-col gap-3">
			<div class="flex items-center gap-2">
				<Users class="size-4 text-rubra" />
				<h2 class="text-xs uppercase tracking-[0.2em] text-muted-foreground">Role hráčů</h2>
			</div>
			<p class="text-sm leading-relaxed text-muted-foreground">
				Každá role má vlastní schopnost. Vyhodnocuje ji vedoucí v okamžiku použití.
			</p>
			<div class="grid gap-2 md:grid-cols-2">
				{#each roles as r (r.name)}
					<div class="rounded-xl border border-border bg-card/40 px-4 py-3">
						<div class="text-sm font-semibold tracking-tight">{r.name}</div>
						<div class="mt-1 text-xs leading-relaxed text-muted-foreground">{r.skill}</div>
					</div>
				{/each}
			</div>
		</section>

		<!-- Struktura kola -->
		<section class="flex flex-col gap-3">
			<h2 class="text-xs uppercase tracking-[0.2em] text-muted-foreground">
				Kolo má 4 fáze
			</h2>
			<p class="text-sm leading-relaxed text-muted-foreground">
				Hra trvá <strong>12 kol</strong>. Každé kolo má pevné pořadí fází:
			</p>
			<div class="flex flex-col gap-2">
				{#each phases as ph (ph.n)}
					<div class="flex gap-3 rounded-xl border border-border bg-card/40 px-4 py-3">
						<div
							class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-rubra/15 text-sm font-bold text-rubra"
						>
							{ph.n}
						</div>
						<div class="flex flex-1 flex-col gap-0.5">
							<div class="flex items-baseline justify-between gap-3">
								<span class="text-sm font-semibold tracking-tight">{ph.title}</span>
								<span
									class="font-mono text-[11px] uppercase tracking-widest text-muted-foreground"
								>
									{ph.time}
								</span>
							</div>
							<span class="text-xs leading-relaxed text-muted-foreground">{ph.text}</span>
						</div>
					</div>
				{/each}
			</div>
		</section>

		<!-- Co můžeš dělat ve fázi Akce -->
		<section class="flex flex-col gap-3">
			<h2 class="text-xs uppercase tracking-[0.2em] text-muted-foreground">
				Co můžeš dělat ve fázi Akce
			</h2>
			<div class="grid gap-2">
				<div class="flex gap-3 rounded-xl border border-border bg-card/40 px-4 py-3">
					<Syringe class="mt-0.5 size-4 shrink-0 text-viridis" />
					<div class="flex flex-col gap-0.5">
						<span class="text-sm font-semibold">Vývoj léku</span>
						<span class="text-xs leading-relaxed text-muted-foreground">
							Splň fyzickou úlohu na stanici (šifra, vzorek, sestavení, hledání…). Vedoucí ti
							potvrdí splnění a posune fázi léku o 1.
						</span>
					</div>
				</div>
				<div class="flex gap-3 rounded-xl border border-border bg-card/40 px-4 py-3">
					<Heart class="mt-0.5 size-4 shrink-0 text-rubra" />
					<div class="flex flex-col gap-0.5">
						<span class="text-sm font-semibold">Léčba sebe</span>
						<span class="text-xs leading-relaxed text-muted-foreground">
							Na karanténní stanici splň úkol a vedoucí ti sníží tvou nákazu o 1 stupeň.
						</span>
					</div>
				</div>
				<div class="flex gap-3 rounded-xl border border-border bg-card/40 px-4 py-3">
					<Vote class="mt-0.5 size-4 shrink-0 text-aurum" />
					<div class="flex flex-col gap-0.5">
						<span class="text-sm font-semibold">Hlasování o krizi</span>
						<span class="text-xs leading-relaxed text-muted-foreground">
							Pokud leží krizová karta, můžeš na telefonu odhlasovat preferenci. Hlas je
							<strong>poradní</strong> — finální slovo má vedoucí.
						</span>
					</div>
				</div>
				<div class="flex gap-3 rounded-xl border border-border bg-card/40 px-4 py-3">
					<Megaphone class="mt-0.5 size-4 shrink-0 text-destructive" />
					<div class="flex flex-col gap-0.5">
						<span class="text-sm font-semibold">SOS</span>
						<span class="text-xs leading-relaxed text-muted-foreground">
							Velké červené tlačítko dole na telefonu. Stiskni, kdykoliv potřebuješ pomoc —
							zdravotní, organizační, jakoukoliv. Vedoucí to uvidí.
						</span>
					</div>
				</div>
			</div>
		</section>

		<!-- Lék -->
		<section class="flex flex-col gap-3">
			<h2 class="text-xs uppercase tracking-[0.2em] text-muted-foreground">Lék 0 → 4</h2>
			<Card class="bg-card/60 backdrop-blur">
				<CardContent class="flex flex-col gap-3 py-6">
					<p class="text-sm leading-relaxed">
						Každá nemoc má škálu vývoje léku <strong>0 → 4</strong>. Cesta: 3 splněné fyzické
						úlohy + závěrečná fáze = lék hotov.
					</p>
					<ul class="flex flex-col gap-1 text-sm leading-relaxed text-muted-foreground">
						<li><strong class="text-foreground">0</strong> — nic</li>
						<li><strong class="text-foreground">1, 2, 3</strong> — postupné fáze</li>
						<li>
							<strong class="text-foreground">4</strong> — lék hotov: nemoc se přestane šířit,
							léčí se snadno
						</li>
					</ul>
					<Separator />
					<p class="text-xs leading-relaxed text-muted-foreground">
						Když je lék hotový <em>a zároveň</em> ve všech městech je tato nemoc na 0, je
						<strong>vymýcena</strong>.
					</p>
				</CardContent>
			</Card>
		</section>

		<!-- Krizové karty -->
		<section class="flex flex-col gap-3">
			<h2 class="text-xs uppercase tracking-[0.2em] text-muted-foreground">Krizové karty</h2>
			<Card class="bg-card/60 backdrop-blur">
				<CardContent class="flex flex-col gap-3 py-6 text-sm leading-relaxed">
					<p>
						Vedoucí občas vylosuje <strong>krizovou kartu</strong> — má název, popis a 2–4
						možnosti řešení s různými dopady (snížit lék, karanténa, ubrat čas…).
					</p>
					<p class="text-muted-foreground">
						Máš <strong>1 minutu</strong> na hlasování přes telefon. Vedoucí pak vybere variantu;
						může respektovat hlasy nebo rozhodnout jinak (drama, bezpečnost). Dopady propíše
						engine sám.
					</p>
				</CardContent>
			</Card>
		</section>

		<!-- Pandemický čítač + šíření -->
		<section class="flex flex-col gap-3">
			<h2 class="text-xs uppercase tracking-[0.2em] text-muted-foreground">
				Pandemie a šíření
			</h2>
			<div class="grid gap-2 md:grid-cols-2">
				<div class="rounded-xl border border-border bg-card/40 px-4 py-3">
					<div class="text-sm font-semibold">Pandemický čítač</div>
					<p class="mt-1 text-xs leading-relaxed text-muted-foreground">
						Stoupá pokaždé, když propukne pandemie, nebo když to nařídí krizová karta. Dosáhne-li
						<strong>8</strong>, prohráváte.
					</p>
				</div>
				<div class="rounded-xl border border-border bg-card/40 px-4 py-3">
					<div class="text-sm font-semibold">Fáze šíření</div>
					<p class="mt-1 text-xs leading-relaxed text-muted-foreground">
						Engine přidá nákazu 3 náhodným městům (+1 stupeň). Z 3 → 4 = pandemie, řetězová
						nákaza sousedů.
					</p>
				</div>
				<div class="rounded-xl border border-border bg-card/40 px-4 py-3 md:col-span-2">
					<div class="text-sm font-semibold">Epidemie</div>
					<p class="mt-1 text-xs leading-relaxed text-muted-foreground">
						Každé <strong>3. kolo</strong> (3, 6, 9, 12) jedno náhodné město skočí rovnou na
						stupeň 3.
					</p>
				</div>
			</div>
		</section>

		<!-- Co vidíš na telefonu -->
		<section class="flex flex-col gap-3">
			<h2 class="text-xs uppercase tracking-[0.2em] text-muted-foreground">
				Co máš na telefonu
			</h2>
			<Card class="bg-card/60 backdrop-blur">
				<CardContent class="flex flex-col gap-2 py-6 text-sm leading-relaxed">
					<ul class="flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground">
						<li>velký indikátor pohybu podle tvé nákazy (stupeň 0–3 + slovní pravidlo),</li>
						<li>vlastní stav nákazy (4 puntíky podle nemocí),</li>
						<li>svou roli a její schopnost,</li>
						<li>vývoj všech 4 léků (jen ke čtení),</li>
						<li>tým a kdo je online,</li>
						<li>aktuální krizovou kartu s hlasováním (pokud leží),</li>
						<li>SOS tlačítko dole.</li>
					</ul>
					<Separator class="my-1" />
					<p class="text-xs text-muted-foreground">
						<strong>Nemáš</strong> tlačítko pro posun léku ani pro léčbu sebe. O všem rozhoduje
						vedoucí po splnění fyzické úlohy.
					</p>
				</CardContent>
			</Card>
		</section>

		<!-- Bezpečnost -->
		<section class="flex flex-col gap-3">
			<h2 class="text-xs uppercase tracking-[0.2em] text-muted-foreground">Bezpečnost</h2>
			<div
				class="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-4"
			>
				<AlertTriangle class="mt-0.5 size-5 shrink-0 text-destructive" />
				<div class="flex flex-col gap-2 text-sm leading-relaxed">
					<p>
						<strong>Bezpečnost vždy přebíjí pravidla.</strong> Když je něco moc — bolí to,
						nezvládáš dýchat, jsi opravdu mimo — řekni to vedoucímu nebo zmáčkni SOS. Žádné drama
						s tím nesouvisí.
					</p>
					<p class="text-foreground/80">
						Nikdo nikoho nezvedá. Nikdo neskáče po jedné noze. Nikdo se nedotýká očí cizíma
						rukama.
					</p>
				</div>
			</div>
		</section>

		<footer class="mt-4 flex flex-col items-center gap-2 text-center text-xs text-muted-foreground">
			<span>Hodně štěstí. Až svět padne, sejdete se a proberete to.</span>
			<a
				href="/"
				class="uppercase tracking-[0.2em] hover:text-foreground"
			>
				← Zpět na úvod
			</a>
		</footer>
	</div>
</div>
