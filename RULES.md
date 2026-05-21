# PANDEMIC — Krizový štáb

Hybridní hra inspirovaná deskovou hrou Pandemic. Část běží na telefonech a projektoru, část se hraje fyzicky v klubovně / na hřišti / v lese. Doporučená sestava: **5–8 hráčů** + **1 vedoucí**.

---

## Cíl hry

Vyvinout **lék na všechny 4 nemoci** dřív, než se svět zhroutí.

Vyhráváte, když:
- jsou vyvinuté všechny 4 léky (lenient mód — výchozí), **nebo**
- jsou vyvinuté všechny 4 léky **a** ve všech městech je nákaza vyčištěna (strict mód, lze přepnout v nastavení).

Prohráváte, když:
- pandemický čítač dosáhne **8** (= „svět padl"),
- nebo uplyne **12. kolo** a léky nejsou hotové.

---

## Co je ve hře

### Mapa
- Síť **měst** propojená cestami. Každé město má svou *regionální barvu* (= odpovídá jedné ze 4 nemocí).
- Některá města jsou **stanice** — slouží k vývoji léku a léčení.
- Mapu vidíte na **projektoru** (vedoucího notebook / TV). Hráči na telefonu mapu nepotřebují, ti se dívají na svůj **stav nákazy** a **roli**.

### 4 nemoci
| Klinické jméno | Skautské jméno    |
|----------------|--------------------|
| Rubra          | Rudý kašel         |
| Viridis        | Zelená horečka     |
| Nox            | Černý stín         |
| Aurum          | Zlatá zimnice      |

Téma se volí při založení hry. Funkčně jsou všechny 4 nemoci stejné — liší se jen barvou a chováním v krizových kartách.

### Stupně nákazy ve městě
Každé město může být nakažené jednou (nebo více) nemocemi, každou ve stupních **0–3**.
- **0** = čisté
- **1** = nákaza
- **2** = epidemie ve městě
- **3** = ohrožení pandemií. Pokud město už je na 3 a má dostat další stupeň téže nemoci → **propukne pandemie** (čítač +1, nemoc se rozšíří do všech sousedních měst řetězově).

### Pandemický čítač
Společný čítač, který stoupá:
- pokaždé, když propukne pandemie,
- nebo když krizová karta nařídí „pandemic_add".

Pokud dosáhne **8**, prohráváte hru.

---

## Role hráčů

Vedoucí rozdá role nebo si je hráči zvolí v lobby. Každá role má **vlastní schopnost**:

| Role          | Schopnost                                                                  |
|---------------|----------------------------------------------------------------------------|
| Koordinátor   | Jednou za hru může zrušit špatné týmové rozhodnutí.                        |
| Epidemiolog   | Vidí, která města se nakazí v dalším kole.                                 |
| Medik         | Léčí o **2 stupně** místo 1.                                               |
| Logistik      | Nese **2 zdroje** zároveň.                                                 |
| Výzkumník     | Sleva na vývoj léku.                                                       |
| Spojka A      | Smí utíkat i při nákaze 1. stupně.                                         |
| Spojka B      | Smí utíkat i při nákaze 1. stupně.                                         |
| Technik       | Opraví stanici poškozenou krizí.                                           |

Role je vidět hráči na telefonu. Schopnost vyhodnocuje **vedoucí** v okamžiku, kdy hráč role využije.

---

## Stav hráče — vlastní nákaza

Každý hráč má vlastní stupeň nákazy (0–3) pro každou z nemocí. Stupeň určuje, **jak se může pohybovat** ve fyzickém prostoru:

| Stupeň | Pravidlo pohybu       | Detail                                                                 |
|--------|------------------------|------------------------------------------------------------------------|
| 0      | Volný pohyb            | Pohybuješ se normálně, můžeš utíkat.                                  |
| 1      | Jen chůze              | Nesmíš běhat. Choď klidně. (Výjimka: Spojky A/B smí utíkat i na st. 1.)|
| 2      | Chůze s omezením       | Choď s rukama za zády, nebo s parťákem za ruku (vedoucí určí variantu).|
| 3      | Doprovod nutný         | Nemůžeš jít sám. Doprovází tě 1–2 spoluhráči (nikdy tě nezvedají).     |

**Tvrdá pravidla bez výjimky:** Nikdy nikdo nezvedá nikoho jiného, nikdo neskáče po jedné noze, nikdo se nedotýká očí cizíma rukama. Bezpečnost > drama.

---

## Struktura kola

Hra má **12 kol**. Každé kolo má 4 fáze v pevném pořadí:

### 1️⃣ Porada (60 s)
Tým se sejde u projektoru, kouká na mapu, plánuje. Telefony jsou v ruce, ale fyzicky se nehýbete.

### 2️⃣ Akce (6 minut)
Hlavní fáze. Hráči chodí mezi **stanicemi** (= fyzická místa v klubovně), plní úkoly a získávají postup pro tým:
- **Vývoj léku** — hráč splní fyzickou úlohu (např. správně namíchat „vzorek", vyluštit šifru, sestavit obvaz). Když je úloha hotová a vedoucí potvrdí, **vedoucí klikne v admin panelu „+1"** u dané nemoci — fáze léku stoupne o 1.
- **Léčba hráče** — hráč může na stanici splnit úkol, kterým si **sníží svou vlastní nákazu** o 1 stupeň (vedoucí klikne na příslušný puntík nákazy v admin panelu).
- **Hlasování o krizi** — pokud zrovna leží krizová karta, můžeš na telefonu odhlasovat svou preferenci. Hlas je poradní, **vedoucí rozhoduje**.
- **SOS** — když potřebuješ pomoc (zdravotní, organizační, kohokoliv), zmáčkneš velké červené tlačítko. Vedoucí to uvidí.

### 3️⃣ Vyhodnocení (60 s)
Vedoucí může:
- ukončit krizovou kartu (vybrat volbu),
- vrátit fázi léku zpět („−1") pokud úloha nebyla splněna pořádně,
- losovat novou krizi (jednou za 2–3 kola, podle dramatu).

### 4️⃣ Šíření (≈30 s, většinou automaticky)
Engine **náhodně rozhází nové nákazy** do 3 měst. Každé město dostane +1 stupeň své regionální nemoci. Když některé město přejde z 3 → 4 (= pandemie), **čítač skočí, sousedi se nakazí řetězově**.

Každé **3. kolo** (3, 6, 9, 12) navíc proběhne **epidemie**: jedno náhodné město skočí rovnou na stupeň 3.

---

## Lék — od stupně 0 do 4

Každá nemoc má škálu vývoje léku **0 → 4**:
- 0 = nic
- 1, 2, 3 = postupné fáze (= 3 splněné fyzické úlohy na stanici)
- 4 = **lék hotov** (`cure_done`). Nemoc se přestane dál šířit, hráči ji můžou snadno léčit.

Když je lék hotový a **zároveň** ve všech městech je tato nemoc na 0, nemoc je **vymýcena** (`disease_eradicated`).

Vedoucí stupeň léku posouvá ručně v admin panelu po splnění fyzické úlohy — engine sám lék neposouvá.

---

## Krizové karty

Občas (řízeně vedoucím — tlačítko „Vylosovat krizi") přijde **krizová karta**. Má:
- **Název** (např. „Sabotáž", „Únik v laboratoři", „Karanténa")
- **Popis** situace
- **2–4 možnosti řešení**, každá má své dopady (např. snížit lék, uvalit karanténu na město, zranit hráče, ubrat čas atd.)

Tým má 1 minutu na **hlasování** (přes telefon). Vedoucí pak vybere variantu (může respektovat hlasy nebo rozhodnout jinak — třeba kvůli dramatu nebo bezpečnosti).

Dopad krize **propíše do hry engine** — pandemický čítač, fáze léku, karantény, zdroje atd. se aktualizují automaticky.

---

## Co dělá vedoucí

Vedoucí je **soudce + dramaturg**:
- Spouští/pauzuje hru, posouvá fáze (tlačítko „Další fáze").
- Rozdává role.
- Vyhodnocuje fyzické úlohy: posuneš fázi léku, snížíš hráči nákazu.
- Losuje krize, rozhoduje o jejich vyřešení.
- Manuálně přidá nákazu městu, pokud chce přitvrdit („+1 infekce náhodnému městu").
- Může hru ukončit dřív (tlačítko „Ukončit hru" = `manual_admin_end`).

V admin panelu má **Záchranný odkaz** — bookmarkni si ho. Když ti spadne notebook nebo se přihlásíš jinde, klikneš na něj a obnovíš relaci vedoucího.

---

## Co vidí projektor

Hlavní okno `/board/<KÓD>` ukazuje:
- mapu se všemi městy a jejich nákazami (kroužky kolem města),
- pandemický čítač (0/8),
- vývoj všech 4 léků,
- aktuální kolo a fázi s odpočtem,
- pás událostí dole.

Při kliknutí na pás událostí se otevře **samostatné okno** `/board/<KÓD>/events` — vhodné pro **druhý projektor** nebo monitor. Vyřazený displej s velkým textem, kde tým průběžně vidí, co se stalo (nákazy, pandemie, posuny léku, krize).

---

## Co vidí hráč

Telefon `/play/<KÓD>` (přihlášený přes `/join`) ukazuje:
- **Velký indikátor pohybu** podle vlastní nákazy (stupeň 0–3 + slovní pravidlo),
- vlastní stav nákazy (4 puntíky podle nemocí),
- svou roli a její schopnost,
- vývoj léku (jen ke čtení — posouvá vedoucí),
- tým a kdo je online,
- aktuální krizovou kartu (pokud existuje) s hlasováním,
- **SOS tlačítko** dole.

Hráč **nemá žádné tlačítko pro posun léku ani pro léčbu sebe**. Vše rozhoduje vedoucí.

---

## Doporučený fyzický scénář

Vedoucí si připraví **stanice** v prostoru — typicky 4–6 míst:
1. **Laboratoř** (lék pro Rubru) — fyzická úloha typu „smíchej dva vzorky a najdi heslo"
2. **Centrála** (lék pro Viridis) — luštění šifry
3. **Sklad** (lék pro Nox) — manuální zručnost, sestavování
4. **Pole** (lék pro Aurum) — venkovní úloha, hledání
5. **Karanténní stanice** — sem se chodí pro „vyléčení sebe"
6. **Operační středisko** = projektor + vedoucí

Stanice mohou být fyzicky někde uvnitř (klubovna) nebo venku (les, hřiště) — engine je city-agnostic. Důležité jsou jen **úlohy** a **kdo je validuje** (vedoucí).

Jeden cyklus (1 kolo ≈ 8 min) by měl umožnit hráčům proběhnout 1–2 stanice. Engine se postará o to, aby šíření drželo tempo.

---

## Tipy pro vedoucího

- **Před hrou:** projdi 1–2 testy s jedním hráčem — ať víš, jak rychle se hraje s konkrétní partou.
- **První kolo bývá pomalé** — fáze Porada slouží k vysvětlení, klidně ji prodluž ručně (pauza + pokračovat).
- Když se tým **nudí**, dej krizi nebo manuální nákazu. Když je v **panice**, podrž krize.
- **Bezpečnost** > pravidla. Pokud někdo opravdu nemůže pokračovat, vyleč ho (drop stage) i mimo pravidla.
- **Konec hry** se nehraje na drama. Až spadne čítač na 8 nebo dojdou kola, prostě skončete a proberte to.

---

## Slovníček událostí

Co znamená co v pásu událostí:

| Událost                      | Význam                                                            |
|------------------------------|--------------------------------------------------------------------|
| Hra vytvořena                | Vedoucí založil novou hru.                                         |
| Hráč XY se připojil          | Někdo nascanoval kód a vstoupil.                                   |
| Hra začala — fáze Porada     | Vedoucí spustil hru, jedeme 1. kolo.                               |
| Začalo kolo N — fáze XYZ     | Vyšli jsme do další fáze.                                          |
| Nákaza: Praha (Rubra, st. 1) | Engine přidal nákazu ve fázi Šíření.                               |
| Pandemie v Praze (Rubra)     | Praha přetekla — čítač +1, sousedi se nakazili řetězově.           |
| Ruční nákaza: ...            | Vedoucí přidal nákazu ručně (tlačítko v admin panelu).             |
| Postup léku: Viridis — 2/4   | Hráč splnil úlohu, vedoucí kliknul „+1".                           |
| Lék hotov: Viridis           | Lék je na 4/4 — nemoc se přestane šířit.                           |
| Nemoc vymýcena: Viridis      | Lék hotov a navíc už nikde v městech není nákaza.                  |
| Hráč XY vyléčen — Rubra (st. 1) | Vedoucí klikl na puntík nákazy hráče.                          |
| Vylosována krizová karta     | Vedoucí mačkl tlačítko „Vylosovat krizi".                          |
| Krize vyřešena               | Vedoucí potvrdil variantu.                                         |
| XY hlasuje pro: vysetrit     | Hráč na telefonu vybral volbu (poradní hlas).                      |
| SOS — XY potřebuje pomoc     | Někdo zmáčkl velké červené tlačítko.                               |
| Hra skončila — vítězství     | Léky hotové (a podle módu i mapa čistá).                           |
| Hra skončila — prohra        | Čítač pandemie ≥ 8, nebo došla kola.                               |

---

## Známá omezení

- **Místa stanic** v současné verzi nejsou propojená s mapou v aplikaci — engine pracuje s městy, ale které město odpovídá které fyzické stanici si vedoucí drží v hlavě (nebo si to napíše na papír). Plánujeme stanice do aplikace doplnit.
- **Hlasy** se nepočítají automaticky — vedoucí vidí v pásu událostí, kdo jak hlasoval, ale součet nehlídá engine.
- **Zdroje** (vzorek, léčivo, energie, data, personál) v aplikaci existují, ale výchozí flow je nepoužívá — připraveno pro pokročilejší scénáře.

---

*Hodně štěstí. Až svět padne, sejdete se a probereme to.*
