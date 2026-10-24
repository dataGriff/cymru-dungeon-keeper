# Steward of Annwn — design framework backlog

Format: as `docs/backlog.md` (each `##` heading is one issue, `[M#]` the milestone, the `labels:` line comma-separated, the rest the body). `scripts/create-issues.sh dataGriff/cymru-dungeon-keeper docs/backlog-design.md` creates them.

Milestones:
- M8 Design framework — one source of truth for how the hall looks, with the tools to keep it that way

---

## [M8] Design tokens as the single source of truth
labels: design, ui, render
Colours, type, spacing, radii, z-order and motion live in one typed module (`src/design/tokens.ts`). The stylesheet reads them as CSS custom properties generated from that module; the canvas renderer reads the same objects. Today the same ember orange is written out in CSS, in `palette.ts`, in the toolbar, in the board and in the box script.

Acceptance
- `src/design/tokens.ts` exports the palette (UI and board), type scale, spacing scale, z-order, durations
- The stylesheet's `:root` variables are generated from it at start-up; no colour literals in `src/ui/**` or the component styles outside the token files
- A test fails if a raw hex colour appears in `src/ui/**` or the component CSS

## [M8] Split the stylesheet into cascade layers and one button component
labels: design, ui
`src/style.css` has grown by appending: three generations of button styles and overrides on overrides. Split it into files under `src/styles/` (tokens, base, layout, components, board, manual, screens) inside `@layer`s, and make one button component with variants (tool, square, menu, primary, ghost, level) that share hover, active, pressed, disabled and focus-visible states.

Acceptance
- No selector is restyled later in a different file to undo an earlier rule
- Every button in the game uses the component; states look the same everywhere
- Visual parity with the art pass (screenshots before and after)

## [M8] One pixel-art format for every hand-drawn asset
labels: art, design
Figures already live in `art/figures.json`. Icons are in `src/ui/icons.ts`, engines in `sprites.ts`, the heart-gem in `tiles.ts`, again in `icons.ts` and again in `build-box.mjs`, the dais twice. Move every hand-drawn pixel map into `art/pixels.json` (or alongside figures) with the same row-and-palette format, one reader for the game and one for the build scripts, and a validator.

Acceptance
- No pixel map is defined twice; the box, the manual, the HUD and the board draw the same heart
- A test validates every map: rectangular rows, every key in its palette, palette values are tokens or hex
- Adding an icon is a JSON edit

## [M8] Living style guide page
labels: design, ui
A second page, `/styleguide.html`, built with the game: tokens (swatches with names and contrast), the type scale, every button variant in every state, the HUD cells, the log, the manual page, every icon, every figure in every frame, every tile, the engines and the particle palette. Drawn with the real components and renderers, so it cannot drift.

Acceptance
- `task dev` serves it; `task build` includes it; linked from the README
- Renders deterministically (fixed animation clock) for screenshot tests

## [M8] Visual regression tests
labels: test, design
Playwright screenshot tests of the style guide sections and three game screens (title, the Cairn at a fixed seed and clock, a manual page), compared with committed baselines at a small threshold. `task visual` runs them; `task visual:update` refreshes the baselines; CI runs them.

Acceptance
- A deterministic render mode (`?still`) freezes the clock, particles and flicker
- CI fails on an unintended change to any component, icon, sprite or tile

## [M8] Contrast and colour-vision checks on the palette
labels: test, design
Unit tests that compute WCAG contrast for every text/background token pair the UI uses (body text ≥ 7:1 on the dark, ≥ 4.5:1 for secondary text, the same on parchment) and check that the health-bar pairs remain distinguishable under simulated protanopia, deuteranopia and tritanopia.

Acceptance
- Failing pairs are fixed in the tokens, not suppressed
- The pairs are declared next to the tokens, so a new pair gets checked

## [M8] Themes from tokens: default, high contrast, the Hunt
labels: design, ui, render
A theme is a token override set. Ship three: the default hall, a high-contrast theme (brighter ambient, stronger text and outlines, no vignette), and the Hunt's cold palette used automatically on the last level's finale. Settings offers the theme; the board and the UI change together.

Acceptance
- Switching theme needs no reload and touches no component code
- High contrast passes the contrast tests at AAA for all text

## [M8] Self-hosted fonts with metric-matched fallbacks
labels: design, infra
Metamorphous, IM Fell English and VT323 come from Google Fonts today, so the Tauri build and the itch download render in fallbacks offline. Bundle the woff2 files (OFL, with licences), declare `@font-face` with `font-display: swap`, and tune the fallback faces with `size-adjust` and ascent overrides so the swap does not shift the layout.

Acceptance
- No request to fonts.googleapis.com from the game, the box or the manual
- Layout shift on font load is negligible (measured)

## [M8] Pixel-perfect board scaling
labels: render, ui
The board is pixel art on a 2px grid and looks best at whole multiples. Pick the largest integer scale that fits the column (with a half-step fallback only when nothing fits), keep the frame and overlays aligned, and do the same for the manual portrait and the HUD icons.

Acceptance
- At every window width from 360 to 2560 the board's pixels are square and even
- The Fit setting means "largest whole scale that fits"; 1x–4x still force a scale

## [M8] Design guide
labels: design, content
`docs/design.md`: the principles (the 2px grid, the hall's palette and its lights, bone text on near-black, parchment for the manual), the tokens and how to add one, the components and their states, the themes, how to draw a figure, an icon or a tile, the style guide and the visual tests, and the checks a design change must pass.

Acceptance
- A newcomer can add an icon and a theme by following it
- Every rule in it is enforced by a test or shown in the style guide
