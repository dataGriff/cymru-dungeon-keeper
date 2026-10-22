# The design system

How Steward of Annwn looks, where each decision lives, and the tests that
keep it that way. The [style guide](../styleguide.html) (`task dev`, then
`/styleguide.html`) shows all of it, drawn with the game's own code.

## Principles

- **One source per decision.** A colour is written once, in
  `src/design/tokens.ts`. A pixel map is written once, in `art/`. Nothing
  else may hold a literal; tests fail if one appears.
- **The page and the board are one palette.** CSS reads the `ui` tokens as
  custom properties; the canvas reads the `board` tokens through
  `src/render/colors.ts`. A theme changes both.
- **Pixels stay square.** Art sits on a 2-pixel grid and is only ever shown
  at a whole number of device pixels per art pixel.
- **Legibility is tested, not hoped for.** Every text/ground pair and every
  meaningful board colour pair is declared next to the tokens and checked
  in every theme, including under simulated colour blindness.
- **What you see is pinned.** Screenshots of the game and the style guide
  are compared on every push.

## Where things live

| What | Where |
| --- | --- |
| Colours, type, space, sizes, z-index, motion, shadows, fades | `src/design/tokens.ts` |
| Themes (token overrides) | `src/design/themes.ts` |
| Fonts and their fallback metrics | `src/design/fonts.ts`, files and licences in `art/fonts/` |
| Colour maths: alpha, mixing, contrast, colour-vision simulation | `src/design/color.ts` |
| Generated custom properties and `@font-face` rules | `src/styles/tokens.css` (from `task tokens`) |
| The stylesheet, in layers | `src/styles/*.css`, entry `src/styles/index.css` |
| Creatures (16x16) | `art/figures.json` |
| Every other pixel map: icons, engines, the Heart gem, glyphs, room details | `art/pixels.json` |
| Board colours as the renderer sees them, with the theme merged in | `src/render/colors.ts` (`B`, `look`) |
| Pixel-perfect sizes | `src/render/scale.ts` |
| The style guide | `styleguide.html`, `src/styleguide.ts`, `src/styles/styleguide.css` |
| Visual baselines | `tests/visual/__screenshots__` |

## Tokens

`tokens.ts` exports:

- `ui`: interface colours. Each becomes `--name` and `--name-rgb` (a
  triplet), so CSS adds alpha as `rgb(var(--accent-rgb) / 0.3)`.
- `board`: canvas colours, grouped by what they paint (`stone`, `floor`,
  `lair`, `pool`, `light`, `fx`, `hp`, ...). The renderer reads them as
  `B.stone.shades`, `B.light.heart` and so on, and adds alpha with
  `alpha(B.light.heart, 0.95)`, never with a hand-written `rgba()`.
- `type` (families, sizes named by use, leading, tracking), `space` (a 2px
  grid: `--sp-1` is 2px, `--sp-9` 24px), `size`, `z`, `motion`, `shadow`
  and `fade`, each emitted as custom properties (`--fs-hud`, `--sp-4`,
  `--w-board-column`, `--z-menu`, `--dur-fast`, `--shadow-card`,
  `--fade-log`).
- `textPairs` and `boardPairs`: the legibility contract (below).

### Adding or changing a token

1. Edit `src/design/tokens.ts`. Colours are lowercase `#rrggbb`.
2. Run `task tokens` to regenerate `src/styles/tokens.css`.
3. Use it: `var(--my-token)` in a stylesheet, `B.group.name` on the canvas.
4. If it is text on a ground, add a `textPairs` entry; if it carries
   meaning on the board, add a `boardPairs` entry.
5. `task check`. The tests will tell you if the CSS drifted from the
   tokens, if a literal crept in, if a `var()` points nowhere, if an
   interface colour is unused, or if a pair fails.

## The stylesheet

`index.css` imports the layers in order:
`tokens, base, layout, components, screens, utilities`. A later layer wins
regardless of specificity, so overrides go in the right layer rather than
in a longer selector.

- **base**: element defaults, focus rings, `.pixel-icon`.
- **layout**: the page grid, masthead, the board frame, the strips under it.
- **components**: `.btn`, the HUD, tool groups and chips, log, tooltip,
  overlay card, desk menus, profiler.
- **screens**: the manual (`manual.css`), title, briefing, editor
  (`screens.css`), the style guide page.
- **utilities**: `.hidden`, `.sr-only`, reduced motion.

### The button

There is one button: `.btn`. Variants (`--tool`, `--square`, `--primary`,
`--ghost`, `--level`, `--small`, `--tab`, `--ink`, `--menu`) set size and
colour; the states are shared: hover, pressed (`:active`), on (`.active`,
`aria-pressed="true"` or `aria-selected="true"`), `:disabled`, and
`:focus-visible`. State classes are `is-*` (`.is-poor`, `.is-unseen`;
`.is-hover`, `.is-pressed` and `.is-focus` force a state for the style
guide). A new kind of button is a new variant, not a new class.

## Themes

A theme is a set of overrides in `themes.ts`: `ui` colours, `board`
colours (merged one group deep), `fade`s, and three board settings:
`lightFloor` (how dark a creature can get), `vignette`, `figureWash`.

- **The hall**: the tokens as they are.
- **High contrast**: brighter text, accent and outlines, nothing faded, a
  brighter, flatter light, no vignette. Every text pair must pass 7:1.
- **The Hunt**: every light one cold white, a blue-grey dark, an ice
  accent. The game switches to it for the last level's finale, unless the
  player chose high contrast.

`main.ts` sets `data-theme` on `<html>` and calls `setBoardTheme`; the
static tile layer repaints when the colours change. No component knows
which theme is on (a test checks), so a new theme is data only: add it to
`THEMES`, add it to `PICKABLE` if the player may choose it, run
`task tokens`. `?theme=<name>` forces one in the game and the style guide.

## Legibility

`textPairs` lists every text colour on every ground the stylesheets use,
with its minimum: 7:1 for body text, 4.5:1 for secondary text, and the
`fade` it is dimmed with, if any. `boardPairs` lists colours that must stay
apart: health-bar colours (ΔE ≥ 20 for normal vision and under simulated
protanopia, deuteranopia and tritanopia) and bars against their back
(3:1). `src/design/a11y.test.ts` checks them for every theme. When one
fails, change the token, never the pair.

## Fonts

Metamorphous (display), IM Fell English (body) and VT323 (HUD) are served
from `art/fonts/` with their SIL Open Font License; nothing is fetched from
a font CDN. Each family has a `<Name> Fallback` face, a local font scaled
with `size-adjust` and `ascent`/`descent`/`line-gap-override` so text keeps
its size and lines while the real face loads (`font-display: swap`). To
add a face: drop the woff2 and its `OFL.txt` in `art/fonts/<family>/`, add
it to `FACES` with metrics read from the file (`hhea` ascent, descent and
line gap; the letter-frequency-weighted average advance), add it to a
`type.family` stack, run `task tokens`. IM Fell English has no Latin
Extended, so a `ŵ` in body text comes from the fallback.

## Pixel art

Both files are rows of characters with a palette: `.` is transparent, and
every other character is a palette key.

```json
"icon.dig": {
  "palette": { "p": "#c8ced6", "o": "#1a1420" },
  "rows": ["..oppo..", ".oppppo."],
  "variants": { "lit": { "p": "#ffffff" } }
}
```

- `art/figures.json`: every creature at 16x16, outlined automatically
  (`outline` colour) and flipped for facing. The renderer, the sprite
  sheet, the manual PDF and the box art all read it.
- `art/pixels.json`: names are `kind.name` (`icon.*`, `engine.*`,
  `gem.heart`, `tile.*`, `glyph.*`, ...). `variants` override palette
  entries (the Heart's `lit` state); a single-colour map can be recoloured
  at draw time (`drawPixels(ctx, 'glyph.angry', x, y, PX, { color })`).

`src/design/art.test.ts` keeps both sound (rectangular, keys in palettes,
no unused keys, lowercase hex) and fails if a pixel map appears in code.
Draw with `drawPixels`/`drawBeast`/`iconCanvas`; never inline rows.

## Pixel-perfect scaling

The board canvas is 28px per tile and art pixels are 2 canvas pixels
(`PX`). `src/render/scale.ts` picks CSS sizes so each art pixel covers a
whole number of device pixels, accounting for `devicePixelRatio`:

- **Fit** shows the board at the largest such size the column allows
  (672px on a desktop column, 336px on a 360px phone).
- A chosen scale (1×–4×) is snapped to whole device pixels.
- Icons are drawn at whole scales (1–4); the portrait, wave preview and
  icons get their CSS size from `crispSize`.

Draw on the board at multiples of `PX`. A fractional scale (1.5) blurs.

## Checking a visual change

1. `task dev` and look at the game and `/styleguide.html`, in each theme.
2. `task check` for tokens, contrast, fonts and art.
3. `task visual` compares screenshots of the built game in its `?still`
   mode (seed 1, the sim run to a fixed second, a fixed clock, no motion)
   and of the style guide with `tests/visual/__screenshots__`.
4. If the change is meant, `task visual:update` and commit the new
   baselines with it, so the review shows the before and after.

CI runs all of it on every push.
