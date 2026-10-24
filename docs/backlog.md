# Steward of Annwn — backlog

Format: each `##` heading is one issue. `[M#]` is the milestone, `labels:` line is comma-separated. Everything below the labels line is the issue body. `create-issues.sh` parses this file.

Milestones:
- M0 Foundation — the POC rebuilt as a real repo
- M1 Core loop — the sim is fair, readable and testable
- M2 Denizens — creatures with personality and a full bestiary
- M3 Mortals — heroes that force decisions
- M4 Atmosphere — art, light, sound
- M5 The Manual and the Box — the retro goods
- M6 Campaign — progression across the hall
- M7 Ship — desktop build, performance, release

---

## [M0] Scaffold Vite + TypeScript project with Taskfile and mise
labels: infra
Set up the repo from the POC prompt: Vite, TS strict, Vitest, ESLint, `Taskfile.yml` (`dev`, `build`, `test`, `lint`, `check`), `.mise.toml` pinning node and task.

Acceptance
- `task check` passes on a clean clone
- `task dev` serves a blank canvas page
- CI runs `task check` on every PR

## [M0] Port the POC sim into `src/sim` with no DOM dependencies
labels: sim
Move grid, tiles, entities, pathfinding, arrivals and waves out of the single-file POC into pure modules. The sim exposes `step(state, dt)` and nothing in it touches `document` or `canvas`.

Acceptance
- Sim runs headless in Vitest
- A 60-second fixed-step run from the start layout is deterministic given a seed

## [M0] Port rendering, lighting pass and HUD into `src/render` and `src/ui`
labels: render, ui
Recreate the POC look: pixelated 28px tiles, destination-out torch lighting, pulsing Heart, portal rings, entity bars, event log, toolbar.

Acceptance
- Visual parity with the POC artifact at desktop and phone widths
- Toolbar and manual panel are keyboard operable

## [M0] Move bestiary text and stats into a typed `bestiary.ts`
labels: content, sim
One source of truth for every creature: name, gloss, flavour text, field notes, stats, arrival rules. The manual panel, the sim and later the printed manual all read from it.

Acceptance
- Type errors if a creature is missing a field
- Unit test asserts every creature in the sim has a bestiary entry

## [M0] Sim test suite
labels: test, sim
Cover Dijkstra (floor, hero tunnelling, worker restriction), arrival thresholds and caps, hunger leave/eat, wave timing and composition, win/lose, economy (gold seams, room buy/sell, hero drops).

Acceptance
- All listed behaviours have a passing test
- Coverage on `src/sim` above 80%

---

## [M1] Deterministic seeded RNG and fixed-step simulation
labels: sim
Replace `Math.random` in the sim with a seeded generator and run the sim at a fixed tick (e.g. 20 Hz) with render interpolation.

Acceptance
- Same seed and inputs produce identical state
- Frame rate changes do not change outcomes

## [M1] Replace O(n²) Dijkstra with a binary-heap A* and path caching
labels: sim, perf
The POC rescans the whole grid per node. Use a heap, a proper heuristic, and cache paths per entity until the map changes.

Acceptance
- 40 entities on a 48×32 map path within one tick budget (< 4 ms)
- Map edits invalidate affected paths only

## [M1] Room adjacency rules and room size bonuses
labels: sim, design
Rooms should be contiguous regions, not scattered tiles. Treasury capacity and Hatchery food rate scale with region size; a 3×3+ Lair attracts better creatures.

Acceptance
- Painting a room tile not adjacent to the same room starts a new region
- Bestiary arrival rules reference largest-region size, not raw tile count

## [M1] Gold has to be carried
labels: sim, design
Dug gold and hero drops appear as piles. Coblynau carry them to a Treasury; gold outside a Treasury doesn't count toward spend. No Treasury means gold sits on the floor for heroes to steal.

Acceptance
- Piles render, workers path to them, Treasury fills visibly
- A knight walking over a pile removes it and the log says so

## [M1] Creature wages and the pay cycle
labels: sim, design
Every 60s each creature draws its `wage` from the Treasury. Unpaid creatures grow angry, then leave. Makes the Treasury and gold seams matter after the first wave.

Acceptance
- Payday log line with total
- Unpaid creature shows an angry state for one cycle, leaves on the second

## [M1] Pause, speed control and a proper restart
labels: ui
Space pauses, 1/2/3 sets speed, R restarts after confirming. Overlay for win/lose is already there; add a pause overlay.

Acceptance
- Sim does not advance while paused; rendering still animates torches

## [M1] Input polish: drag-paint, right-click to cancel, hover tooltip on tiles
labels: ui
Dragging paints both digs and rooms. Right-click or long-press unmarks/sells. Hovering shows tile type and, for rooms, region size.

Acceptance
- Works with mouse and touch
- No accidental creature-page opens while dragging

---

## [M2] Creature moods and possession-free "ping" interaction
labels: sim, design
Add a mood state (content, hungry, tired, angry, afraid) visible as a small glyph. Clicking a creature with the hand tool nudges it toward the cursor target (no possession, keep it simple).

Acceptance
- Mood changes drive existing AI states
- Nudge overrides wander but never fight or flee

## [M2] Add the Gwyllgi (black dog of the crossroads)
labels: content, sim
Mid-tier guard creature. Arrives for a Lair of 6 and a Treasury of 3. Slow to anger, immovable once fighting; takes reduced damage when standing on a corridor tile (it holds the road). Write its bestiary entry in the established voice.

Acceptance
- Entry in `bestiary.ts` with gloss, text, three field notes
- Sprite via `drawBeast`, arrival test

## [M2] Add the Ceffyl Dŵr (water horse)
labels: content, sim
Requires a new room: the Pool (dig a tile adjacent to water, or a new tile type). Fast, charges down corridors, breaks engagement after a hit. Afanc and Ceffyl Dŵr compete for the Pool and bicker.

Acceptance
- Pool room with its own art and lighting
- Rivalry: both lose a little mood when sharing a Pool region

## [M2] Add the Tylwyth Teg emissary (fair folk)
labels: content, sim
Non-combatant that arrives when the Treasury is rich. Trades gold for creature healing or a temporary ward on the Gate. Leaves offended if attacked or if the Pwca steals from it.

Acceptance
- Trade UI (small dialogue card in the manual panel's voice)
- Pwca interaction logged

## [M2] Creature infighting and the Lair as territory
labels: sim, design
Creatures that dislike each other (hounds and Pwca; Afanc and Ceffyl Dŵr) squabble when sharing a Lair region. Separate Lairs fix it. Teaches the player to build more than one of everything.

Acceptance
- Dislike matrix in `bestiary.ts`
- Squabble damages mood, not HP, and logs once per minute at most

## [M2] Bestiary unlocks and the "sighted" state
labels: ui, content
Manual pages start as silhouettes with the gloss only. Full text unlocks the first time the creature is seen in the hall; field notes unlock after it survives a wave. Progress persists in localStorage.

Acceptance
- Silhouette rendering from `drawBeast` with a black fill
- Unlock events logged in the manual voice

---

## [M3] Hero types: Cantref Lord, Cwrw-drunk Levy, Saint's Reliquary bearer
labels: content, sim
Three new mortals with distinct threat shapes: the Lord (tanky, targets your strongest creature), the Levy (cheap, many, panics when the first dies), the Reliquary bearer (no attack, but creatures near the relic can't fight; kill the bearer first). Bestiary pages for each.

Acceptance
- Each has one behaviour the player must counter differently
- Wave composition table references them

## [M3] Hero morale and retreat
labels: sim, design
Heroes have morale. Losing allies, meeting an Afanc, or taking a dark corridor lowers it. At zero they flee to the Gate and leave with any gold they carry. Winning without killing becomes possible.

Acceptance
- Fleeing hero pathing back to the Gate
- Log and HUD reflect fled vs slain

## [M3] Wave designer: data-driven waves with previews
labels: sim, ui
Waves defined in data (time, composition, entry gate). The HUD shows the next wave's composition as hero icons so the player can prepare. Allow multiple Gates on larger maps.

Acceptance
- Wave schedule in a JSON/TS file per level
- Preview icons match what spawns

## [M3] Traps: pit, boulder, cold iron snare
labels: sim, content
Three placeable traps costing gold, built by Coblynau. Pit (one-shot, slows), boulder (rolls down a straight corridor), cold iron snare (holds a hero in place, hurts fair folk too). Manual pages in an "Engines of the Hall" section.

Acceptance
- Construction takes worker time, not instant
- Each trap has a bestiary-style page with field notes

## [M3] Difficulty curve pass
labels: design
Play-test the three-wave POC against a target of "a first-time player wins on the second attempt". Tune stats, thresholds and wave timing. Record findings in `docs/balance.md`.

Acceptance
- Written balance notes with the numbers changed and why
- Automated sim run: scripted "reasonable player" survives wave 3 in > 60% of seeds

---

## [M4] Real pixel sprite sheet for all denizens and mortals
labels: art
Replace the rectangle `drawBeast` figures with a 16×16 (or 24×24) sprite sheet: idle, walk (4 frames), attack, sleep, eat, dead. Keep `drawBeast` as the abstraction so the manual portrait and board share frames.

Acceptance
- Sheet committed as PNG with a source file (Aseprite or similar)
- Silhouette mode still works for locked bestiary pages

## [M4] Tileset with autotiling
labels: art, render
Rock faces, floor variants, room edges and corners via a bitmask autotiler. Gold seams glint. Dug tiles leave rubble for a few seconds.

Acceptance
- No visible tiling seams on room boundaries
- Autotile logic unit-tested on the 47-tile blob set (or the 16-tile subset if chosen)

## [M4] Lighting upgrade: coloured light sources and shadows
labels: render
Heart glows red, Portal violet, torches orange, Pool cold blue. Entities cast simple blob shadows. Keep the destination-out approach or move to an offscreen light map with multiply blend.

Acceptance
- Runs at 60 fps on a mid-range laptop at 1080p
- Reduced-motion setting disables flicker

## [M4] Ambient and reactive audio
labels: audio
Drones and drips from the POC, plus: hound baying that gets quieter as they close (the manual says so, make it true), pick-on-stone when digging, Heart strike bell, hero footsteps that get louder in open corridors. All synthesised or CC0 samples.

Acceptance
- Mixer with master/ambient/sfx sliders
- Nothing plays before the first user gesture

## [M4] Manual panel: page-turn animation and the "scanned" treatment
labels: ui, art
Paper grain, slightly misaligned ink, a page-turn when switching entries, and the running header. The panel should look photographed, not styled.

Acceptance
- Respects reduced motion
- Readable at 400px width

---

## [M5] Printable manual PDF generated from `bestiary.ts`
labels: content, infra
`task manual` renders a 16–24 page A5 PDF: cover, "A Word from the Steward" intro, controls, rooms, Denizens (bestiary), Mortals, Engines of the Hall, a notes page, and the copy-protection joke page ("what is the third word on page 11?"). Same text as in-game, never duplicated.

Acceptance
- PDF in `dist/manual.pdf`, built from the same data as the game
- Looks right printed and folded as a booklet

## [M5] Box front and back mock
labels: art, content
A print-ready box: painted-style front with title treatment and the Cŵn Annwn; back with three "screenshots" (real captures), five bullet points, a dubious review quote, fake system requirements (386DX, 4 MB RAM, VGA, Sound Blaster), and a Hungovercoders publisher mark. Also a 3D-rendered box image for the store page.

Acceptance
- Front, back and spine as PNG and PDF at 300 dpi
- The in-game title screen reuses the front art

## [M5] Title screen, install-screen homage and credits
labels: ui, art
Title screen with the box art and a "Press any key". An optional 3-second fake DOS install progress bar on first run (skippable, can be turned off). Credits in the manual voice.

Acceptance
- First-run flag in localStorage
- Skippable with any key

## [M5] Reference card: one-page quick reference PDF
labels: content
The keyboard overlay card that came in the box: tools, hotkeys, room costs, arrival rules. Built from the same data.

Acceptance
- `task manual` also outputs `reference-card.pdf`

---

## [M6] Level format and loader
labels: sim, infra
Maps as data: size, tile layout, Gates, starting gold, wave schedule, allowed creatures, win condition. Hand-authored levels in `levels/`. The POC map becomes level 1.

Acceptance
- Load any level by id
- Schema validated at build time

## [M6] Five-level campaign across the hall of Annwn
labels: content, design
1. The Cairn (POC map, three waves). 2. The Seam (gold-poor, teaches carrying). 3. The Pool (unlocks Afanc and water horse). 4. The Fair Court (Tylwyth Teg trades, reliquary bearers). 5. The Hunt Returns (hold until Arawn comes home; a huge final wave then the hounds turn on the mortals). Each with a one-paragraph briefing in the manual voice.

Acceptance
- Each level has one new idea and one new creature or hero
- Level 5 ends with the Hunt arriving as a cutscene in the log and lighting

## [M6] Save and load
labels: infra
Save the sim state (not the render) to localStorage and to a file export/import. Campaign progress and bestiary unlocks persist.

Acceptance
- Round-trip test: save → load → identical state
- Version field with a migration hook

## [M6] Sandbox mode with a map editor
labels: ui, design
Free play on a generated map, and an editor to paint levels into the level format. Export as a level file.

Acceptance
- Editor output loads via the level loader
- Procedural map seed shown in the HUD

---

## [M7] Tauri desktop wrapper for macOS and Windows
labels: infra
Wrap the Vite build. App icon from the box art. Window sized to a fixed aspect with integer scaling options.

Acceptance
- `task desktop` produces signed-or-unsigned builds for both
- Fullscreen toggle and integer scaling 1×–4×

## [M7] Performance budget and profiling
labels: perf
Target 60 fps at 48×32 maps with 60 entities on an Intel Mac. Profile pathfinding, lighting and sprite batching; add a debug overlay showing ms per subsystem.

Acceptance
- Debug overlay toggled with F3
- Budget documented in `docs/performance.md` and enforced by a sim benchmark test

## [M7] Accessibility pass
labels: ui
Keyboard-only play, screen-reader labels for HUD values, colour-blind safe hero/creature bars, reduced-motion and no-flicker modes, text scaling.

Acceptance
- Lighthouse accessibility above 90 on the title and game screens

## [M7] itch.io page and web build
labels: infra, content
Web build deployed to itch.io with the box art, manual PDF and reference card as downloads. Page copy in the manual voice.

Acceptance
- `task release` builds, zips and uploads via butler
- Page links the Hungovercoders site

## [M7] Devlog: "Building a Bullfrog game in TypeScript" series
labels: content
Three posts for the Hungovercoders blog: the lighting trick, the bestiary as single source of truth, and generating a retro manual from game data.

Acceptance
- Drafts in `docs/devlog/`, one per post, with screenshots from the real build
