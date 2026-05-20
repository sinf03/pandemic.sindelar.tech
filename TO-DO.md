# PANDEMIC: Krizový štáb — TO-DO

Hybrid online + physical scouting game for ~7 players (variable 5–10).
Stack: **SvelteKit 5 · TypeScript · Tailwind v4 · shadcn-svelte · Supabase**.

This file is the master plan. Each box is an actionable item. We move top-to-bottom roughly, but Section 0 (Decisions) gates everything else — locks in design choices before we build.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done · 🔥 critical path · 💡 nice-to-have · ❓ open question

---

## 0. Design decisions to lock in 🔥

These are choices we should make _before_ writing schema or routes. I've put my recommended default after each — confirm or override.

### 0.1 Game framing

- [ ] ❓ **Disease naming**: clinical-fantasy **Rubra / Viridis / Nox / Aurum** vs. scout-fantasy **Rudý kašel / Zelená horečka / Černý stín / Zlatá zimnice** → _recommend: leader-pick at game creation, ship both as presets_
- [ ] ❓ **Language of in-game UI**: Czech only, English only, or both (i18n) → _recommend: Czech only for MVP, structure code so i18n is possible later_
- [ ] ❓ **Player count target**: fixed 7 vs. flexible 5–10 → _recommend: flexible; the engine treats player count as a config_
- [ ] ❓ **Difficulty preset on launch**: easy (3 diseases, 16 cities) / standard (4, 20) / hard (4, 24) → _recommend: ship all three_

### 0.2 Core numbers (defaults; tweakable in admin)

- [ ] ❓ Number of cities: **20** (range 16–24)
- [ ] ❓ Number of diseases: **4**
- [ ] ❓ City connections: **2–4 edges per city**
- [ ] ❓ Pandemic loss threshold: **8**
- [ ] ❓ Default round count: **10–12**
- [ ] ❓ Phase lengths: Porada **1 min** · Akce **5–7 min** · Vyhodnocení **1 min** · Šíření auto
- [ ] ❓ Infection-spread cities per round: **2–4**
- [ ] ❓ Epidemic frequency: every **2–3 rounds** (or random trigger)
- [ ] ❓ Starting board: 3 cities @ stage 3 · 3 @ stage 2 · 4 @ stage 1
- [ ] ❓ Cure cost per step: **3 resources** (easy) / **5** (hard)
- [ ] ❓ Win condition: "all 4 cures + no city at stage 3" (strict) vs. "all 4 cures + pandemics < 8" (lenient) → _recommend: lenient for MVP_

### 0.3 Roles (7-player baseline)

- [ ] ❓ Confirm role list & special abilities (default below)
  - **Koordinátor** — once per game cancels a bad decision
  - **Epidemiolog** — sees the next round's infection targets
  - **Medik** — heals 2 stages per treatment instead of 1
  - **Logistik** — carries 2 resources at once
  - **Výzkumník** — discount on cure development
  - **Spojka A** — may run even at stage-1 infection
  - **Spojka B** — same; second runner for redundancy
  - **Technik** (optional 8th) — repairs a station broken by a crisis card
- [ ] ❓ Should roles auto-assign or be leader-assigned?
- [ ] ❓ What happens for player counts ≠ 7? (priority order for which roles to drop/add — recommend: drop Spojka B, then Technik, then Logistik)

### 0.4 Movement restriction rules (safety!)

- [ ] ❓ Lock final restriction set (less injury-prone than original — no jumping on one leg, no real carrying)
  - **Stage 0** — free movement
  - **Stage 1** — walk only, no running
  - **Stage 2** — pick one: hands behind back · walking holding a partner's shoulder · carrying a cup of water · tied to another player · short stretches walking backward _(recommend leader picks one rule for the whole game so it's not chaotic)_
  - **Stage 3** — cannot move alone; needs escort by 1–2 players (walking, holding a rope, "evacuated" on a chair) — never lifted

### 0.5 Resource model

- [ ] ❓ Keep single "fazolka" resource or use multi-resource (🧪 Vzorek / 💊 Léčivo / 🔋 Energie / 📡 Data / 🧍 Personál) → _recommend: multi-resource, more strategy_
- [ ] ❓ How are resources physically represented at the event? (printed cards w/ QR? color-coded beans? wooden tokens?)
- [ ] ❓ Carry limit per player (default: 1, Logistik: 2)

### 0.6 Cure development

- [ ] ❓ 4 phases per cure: **Sběr vzorků → Analýza → Klinická zkouška (dilemma) → Distribuce**
- [ ] ❓ Decide concrete tasks for each phase (mix of physical + logic per cure — keep cures distinct so they don't feel repetitive)
- [ ] ❓ Each phase must complete within one round? _(recommend: yes — if a phase isn't finished, the resources are spent but progress stays where it was)_
- [ ] ❓ The Klinická zkouška dilemma — pulled from the crisis-card pool, or its own per-cure dilemma list?

### 0.7 Crisis cards

- [ ] ❓ Frequency: every **2nd round** vs. random trigger (leader's call)
- [ ] ❓ Resolution: leader picks, players vote, or affected role picks → _recommend: team vote, leader breaks ties_
- [ ] ❓ Initial card pool size — target **12–15** for MVP (e.g. _Omezený lék_, _Karanténa města X_, _Únik dat z laboratoře_, _Mediální panika_, _Výpadek stanice_, _Falešný poplach_…)
- [ ] ❓ Effects scope: infection state, resources, cure progress, station status — keep it concrete, no abstract "trust" scores

### 0.8 Player identity model

- [ ] ❓ Players sign in (Supabase Auth magic link) vs. join via short code → _recommend: short code + display name only; no email needed for kids_
- [ ] ❓ Device-per-player or shared-device fallback?

---

## 1. Project & infrastructure setup 🔥

- [x] SvelteKit + Svelte 5 + Tailwind v4 scaffolded
- [x] `@supabase/ssr` + `@supabase/supabase-js` installed
- [x] `.env.example` committed
- [ ] Add `.env.local` for dev with real Supabase URL/key (gitignored)
- [ ] Initialize **shadcn-svelte** via its CLI (`shadcn` package already a dep) — pick base color & set up `components.json`
- [ ] Confirm Tailwind config has the shadcn theme tokens (CSS variables, dark mode `class` strategy)
- [ ] Add Prettier + a single Svelte/TS formatter config
- [ ] Add ESLint with svelte plugin (optional, but catches a lot)
- [ ] Set up commit hooks (husky + lint-staged) — 💡 nice-to-have
- [ ] Decide hosting: **Vercel** (recommend) vs. Cloudflare Pages vs. Netlify
- [ ] Set adapter: `@sveltejs/adapter-auto` → swap to `adapter-vercel` if Vercel
- [ ] Wire `vercel.json` / CI for `pandemic.sindelar.tech` DNS
- [ ] Create production Supabase project (separate from dev)
- [ ] Document local-dev quickstart in `README.md` (npm install, env, supabase start)

---

## 2. Data model (Supabase schema) 🔥

Use the Supabase CLI for migrations (`supabase/migrations/*.sql`); apply locally first, then push.

### 2.1 Tables

- [ ] `games` — id, code (short join code), name, status (`lobby`/`active`/`paused`/`finished`), created_by, settings JSONB (round_count, durations, win/lose thresholds, theme), pandemic_count, current_round, current_phase, ends_at
- [ ] `maps` — id, name, description, payload JSONB (cities + edges), is_template, owner
- [ ] `game_cities` — id, game_id, map_city_id, name, color, x, y, infection_level (per disease), has_station, in_quarantine, removed
- [ ] `game_edges` — id, game_id, city_a_id, city_b_id (or store in maps payload only)
- [ ] `players` — id, game_id, display_name, role, current_city_id (optional), is_admin, joined_at, device_token
- [ ] `player_infections` — player_id, disease_id, stage (0–3)
- [ ] `diseases` — id, game_id, key (rubra/viridis/nox/aurum), name, color, cure_stage (0–4), cured, eradicated
- [ ] `resources` — id, game_id, kind (vzorek/lecivo/energie/data/personal), held_by_player_id NULL = bank
- [ ] `rounds` — id, game_id, number, phase, started_at, ended_at
- [ ] `infection_events` — round_id, city_id, disease_id, delta, was_pandemic
- [ ] `cure_progress` — disease_id, phase (1–4), completed_at, completed_by_player_id
- [ ] `crisis_cards` — id, title, body, options JSONB, effects JSONB, tags
- [ ] `crisis_draws` — game_id, card_id, round_id, chosen_option, applied_at
- [ ] `events_log` — append-only, game_id, kind, payload, at — drives the projector live feed
- [ ] `audit_log` — admin actions (overrides, edits) — 💡 nice-to-have

### 2.2 Migrations & RLS

- [ ] Write initial migration with all tables
- [ ] Add foreign keys + indexes (game_id on every game-scoped table, plus per-player indexes)
- [ ] Enable **RLS** on every table
- [ ] RLS: a player can read their own game's rows; only admins can write game-state mutations (writes go through edge functions or RPCs anyway)
- [ ] RLS: anyone with the game code + display name can claim a player slot once
- [ ] Use `security definer` Postgres functions for mutations that need elevated privileges
- [ ] Seed script: 1 demo map, 4 diseases, ~15 crisis cards

### 2.3 Realtime

- [ ] Enable Supabase Realtime on: `games`, `game_cities`, `player_infections`, `players`, `cure_progress`, `events_log`
- [ ] Decide channel topology: one channel per `game_id`
- [ ] Test latency between two devices

---

## 3. Game engine (logic layer) 🔥

Keep the engine in `src/lib/engine/` as pure-ish TS functions taking state → state + side-effect descriptors. Server is the source of truth; client reads via realtime + optimistic UI.

- [ ] State shape: a single `GameState` interface mirroring the DB rows
- [ ] `startGame(settings)` — assign roles, initial infections, build infection deck
- [ ] `advancePhase(game)` — Planning → Action → Evaluation → Infection → next
- [ ] `treatCity(player, city, disease)` — Medik-aware
- [ ] `treatPlayer(player)` — reduce own stage (after medic task)
- [ ] `developCure(disease, phase)` — verify resources, advance phase
- [ ] `infectionStep(game)` — draw N cities, +1 infection, handle pandemics + chains
- [ ] `epidemic(game)` — bigger spread + reshuffle
- [ ] `pandemicTrigger(city, disease)` — increments counter, spreads to neighbors recursively
- [ ] `applyCrisis(game, card, option)` — mutate indicators + flags
- [ ] `checkWin(game)` / `checkLose(game)`
- [ ] All mutations exposed as Supabase RPCs (`/rest/v1/rpc/*`) with security-definer
- [ ] Unit tests for engine (vitest) — infection chains and pandemics are easy to get wrong

---

## 4. Authentication & sessions

- [ ] Decide auth model (likely: leader = Supabase auth account; players = code + name, anonymous JWT)
- [ ] Sign-in page for leaders (magic link via Supabase Auth)
- [ ] Join flow for players: enter code → pick display name → claim role (or auto)
- [ ] Persist `device_token` so a player rejoining gets back to their slot
- [ ] Leader can kick / re-seat a player from admin
- [ ] Handle "join after game started" (allowed? recommend: yes, into spectator)
- [ ] Session timeout / inactivity handling

---

## 5. Routes / pages

SvelteKit route plan (all under `src/routes/`):

- [ ] `/` — landing, explains the game, "Create game" + "Join game" CTAs
- [ ] `/join` — enter code + name → redirect to `/play/[code]`
- [ ] `/play/[code]` 🔥 — **player mobile view** (the main phone screen)
- [ ] `/board/[code]` 🔥 — **projector / dashboard view** (big screen)
- [ ] `/admin/[code]` 🔥 — **leader control panel**
- [ ] `/admin` — leader dashboard: list my games, create new
- [ ] `/admin/maps` — map management (list, edit, create)
- [ ] `/admin/maps/[id]` — visual map editor
- [ ] `/admin/cards` — crisis card editor
- [ ] `/admin/rules` — default rules editor (settings preset)
- [ ] `/login` — leader auth
- [ ] `/about` / `/rules` — public-facing rules + credits 💡
- [ ] 404 + error pages

---

## 6. Player mobile view `/play/[code]` 🔥

Designed for one-handed phone use in a forest. Big tap targets, high contrast.

- [ ] Top bar: round number + phase + timer
- [ ] My role card (with icon + ability text), collapsible
- [ ] My infection status (per disease) — color-coded + giant indicator of current movement rule
- [ ] My carried resources (icons; tap to "drop at station")
- [ ] Team snapshot: list of teammates, their infection stages, their roles
- [ ] Action buttons (context-aware to phase): "I picked up X", "I'm at medic", "I'm in lab", "I treated city Y"
- [ ] Crisis dilemma modal (when active) with vote/choose buttons
- [ ] Toast/banner for important world events
- [ ] Vibration + sound on round transitions 💡
- [ ] Offline-tolerant: queue actions, reconcile when online 💡
- [ ] Big "infected, need help" SOS button → notifies team

---

## 7. Projector / dashboard view `/board/[code]` 🔥

Fullscreen, 16:9, designed to be projected. No interactive controls (read-only). Atmospheric.

- [ ] Big SVG world map with cities (color = disease, dots/ring = infection stage)
- [ ] Animated infection spread when a city ticks up
- [ ] Pandemic counter as a chunky gauge
- [ ] Cure progress: 4 bars (one per disease), each in 4 segments
- [ ] Round timer (huge, center-bottom)
- [ ] Active event banner: current crisis card / dilemma in progress
- [ ] Event log ticker at the bottom (last 6 events)
- [ ] Win / loss screen + reflection prompts
- [ ] Sound: alarm on epidemic, soft tick on round end 💡
- [ ] Auto-fullscreen / wakelock to keep screen on

---

## 8. Admin / leader panel `/admin/[code]` 🔥

This is the leader's "ops console" during the game.

- [ ] Game setup wizard before start: pick map, roles, rules, players
- [ ] Roster: assign roles, mark players as connected, kick / rename
- [ ] Phase controls: start round, pause, advance phase, reset timer
- [ ] Manual overrides: +1 infection on city, mark city cured, set stage on player
- [ ] Trigger crisis: draw card, pick a specific card, or skip
- [ ] Trigger epidemic on demand
- [ ] Edit cure phase progress
- [ ] "Undo last action" 💡 (relies on events_log)
- [ ] End game manually (with win/lose reason)
- [ ] Post-game: export game log as CSV / PDF for reflection 💡

---

## 9. Map system 🔥

- [ ] Map data structure: `{ cities: [{ id, name, color, x, y, station? }], edges: [[a, b], ...] }`
- [ ] Pick coordinate system: normalized 0–1 (resizes cleanly)
- [ ] Renderer: shared Svelte component used by board, admin, and editor
- [ ] Three built-in templates: 16 cities (easy), 20 (default), 24 (hard)
- [ ] **Map editor** in admin: click to add city, drag to move, shift-click to draw edge, delete to remove
- [ ] Validate map (every city reachable, every city has ≥2 edges, no overlaps)
- [ ] Save / clone / version maps
- [ ] Allow leader to use a real-world map background (CZ map, world map) as a static image layer 💡

---

## 10. Crisis cards & dilemmas

- [ ] Card schema: `{ title, body, options: [{ label, effects }], theme, weight }`
- [ ] Effects engine: each effect mutates indicators / infections / resources / cures
- [ ] Card pool: write **12–15 starter cards** in Czech (e.g., "Omezený lék", "Karanténa města", "Únik dat z laboratoře", "Mediální panika", "Výpadek výzkumné stanice", "Falešný poplach", "Nedostatek personálu"…)
- [ ] Admin UI to create / edit / disable cards
- [ ] Per-game card pool selection (theme-specific decks)
- [ ] Vote resolution UI on player screens
- [ ] Resolution timer (auto-pick default option on timeout)

---

## 11. UI components & design system

- [ ] Install base shadcn-svelte components: Button, Card, Dialog, Drawer, Sheet, Toast, Tabs, Tooltip, Badge, Progress, Separator, Avatar, Input, Label, Select, Switch, Slider, Form
- [ ] Custom components:
  - [ ] `<CityNode>` — colored circle with infection ring
  - [ ] `<DiseaseBadge>` — disease + stage
  - [ ] `<ResourceChip>` — icon + count
  - [ ] `<RoleCard>` — full role with ability
  - [ ] `<RoundTimer>` — circular countdown
  - [ ] `<MovementIndicator>` — huge "WALK ONLY" etc. text card
  - [ ] `<CrisisCard>` — dilemma layout
  - [ ] `<EventTicker>` — animated feed
  - [ ] `<MapCanvas>` — the SVG renderer
- [ ] Pick base color via shadcn CLI (recommend: zinc + an accent like emerald or amber)
- [ ] Define color tokens for the 4 diseases (CSS vars)
- [ ] Light + dark mode; default board view to **dark** (projector friendly)

---

## 12. Theme & atmosphere

- [ ] Pick a visual identity → _recommend: "crisis-center / newsroom" — dark UI, serious typography, restrained motion. Atmospheric without being morbid for teens_
- [ ] Typography: a serious display font for headers (Inter / IBM Plex / Geist) + monospace for system events
- [ ] Disease colors that work on a projector (high contrast, not pastel)
- [ ] Iconography set (lucide-svelte — works with shadcn-svelte)
- [ ] Sound design pass:
  - [ ] Round start (horn)
  - [ ] Round end (horn)
  - [ ] Epidemic (alarm)
  - [ ] Cure completed (chime)
  - [ ] Pandemic (low boom)
  - [ ] Crisis card draw (paper / tone)

---

## 13. Performance, offline, PWA

- [ ] Mobile Lighthouse pass ≥ 90 perf/access
- [ ] Mark `/play` as a PWA with offline shell (add to home screen)
- [ ] Service worker caches the join + role view so a flaky-signal player still sees their status
- [ ] Lazy-load admin and board bundles (not on the player critical path)
- [ ] Image optimization for map backgrounds
- [ ] Wakelock API on the board route to prevent screen sleep

---

## 14. Localization

- [ ] Strings table: extract all UI text into `src/lib/i18n/cs.ts` even if Czech-only for MVP
- [ ] Format helper for relative time / round time
- [ ] Crisis card content in DB stored as plain text (Czech only for MVP) — but schema-ready for `text_cs` / `text_en`

---

## 15. Accessibility

- [ ] All buttons have visible labels (not icon-only without `aria-label`)
- [ ] Color is never the only signal (also use shapes / labels for diseases)
- [ ] Focus states for keyboard nav on admin
- [ ] Min tap target 44×44 px on mobile
- [ ] Reduced-motion respect on animations

---

## 16. Testing

- [ ] Unit: game engine (vitest) — infection chains, pandemics, win/lose
- [ ] Component tests for tricky bits (timer, map renderer) 💡
- [ ] E2E smoke (Playwright): create game → join 3 players → run 2 rounds → trigger epidemic 💡
- [ ] **Real playtest** with another scout leader before the actual event
- [ ] Real playtest with the actual 7 players (dry run weekend before)
- [ ] Mobile device matrix: iPhone Safari, Android Chrome, both portrait & landscape
- [ ] Test on the actual projector + venue Wi-Fi _(critical, do this on-site early)_

---

## 17. Documentation

- [ ] `README.md`: setup, dev, env, deploy
- [ ] `RULES.md`: the canonical game rules in Czech (printable PDF too 💡)
- [ ] In-app help screen on the player view (gestures / what each button does)
- [ ] Leader cheat-sheet (printable, what buttons do during the game)

---

## 18. Deployment

- [ ] Connect repo to Vercel (or chosen host)
- [ ] Production Supabase project + RLS verified on production
- [ ] Set DNS for `pandemic.sindelar.tech` → host
- [ ] HTTPS + HSTS verified
- [ ] Set up error tracking (Sentry free tier) 💡
- [ ] Set up basic analytics (Plausible / Umami) 💡
- [ ] Backup strategy: Supabase nightly backups are default on paid; check if MVP needs upgrade

---

## 19. Pre-event checklist (1 week + day-of)

- [ ] Charge a backup phone + projector cable
- [ ] Print: role cards, resource cards, rules cheat-sheet, crisis cards (paper backup!)
- [ ] Test venue Wi-Fi or set up a phone hotspot
- [ ] Pre-create the game; share QR code for the join URL
- [ ] Brief co-leaders on admin controls
- [ ] Make sure resource pickup areas + medic + research stations are mapped to physical spots

---

## 20. Stretch goals (post-MVP) 💡

- [ ] Multiple concurrent games (different scout groups using the platform)
- [ ] Leader templates marketplace (share map + cards + rules as a "scenario")
- [ ] In-game chat for the team (one channel)
- [ ] Photo proof of completed physical tasks (uploaded by a player, validated by admin)
- [ ] Bluetooth beacons at stations so phones auto-detect player location
- [ ] After-action narrative generator: turns events_log into a story to read at reflection
- [ ] Replay viewer: scrub through the game timeline
- [ ] AI-driven crisis cards: generate a new dilemma from current game state
- [ ] **Scenario packs** (medieval plague, zombie outbreak, climate crisis, _PANDEMIC 2042: Virus vědomí_ sci-fi reskin with society indicators + multiple endings) — these are alternate "skins" of the core engine, not part of MVP

---

## 21. Open questions parking lot

Things to revisit but not block on:

- [ ] How do leaders enforce physical movement rules? (honor system? buddy system?)
- [ ] What's the fallback if Wi-Fi/cell is dead in the forest? (offline PWA + sync later?)
- [ ] Can we run the projector off a laptop in airplane mode using a local-first sync? (Supabase Edge Functions self-hosted? PowerSync?)
- [ ] Should the leader be able to "play" a role _and_ admin, or are those mutually exclusive accounts?
- [ ] Do we want a "spectator" view for parents/observers?

---

## Next concrete step

Once Section 0 decisions are confirmed (even loosely), the first build-tasks are:

1. shadcn-svelte init + theme tokens
2. Supabase migration #1 (games, players, maps, diseases)
3. `/` landing + `/join` + `/play/[code]` skeleton with realtime
4. Game engine `startGame()` + `advancePhase()` covered by unit tests

That's enough to get a "lobby + first round" demo running end-to-end.
