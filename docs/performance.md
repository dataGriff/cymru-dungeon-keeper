# Performance budget

Target: 60 fps (16.7 ms a frame) on a 48×32 hall with 60 entities on an
Intel Mac or a mid-range laptop at 1080p. The board is a 2D canvas; there is
no engine to blame.

## Budget per frame

| Subsystem | Budget | How it is measured |
| --- | --- | --- |
| Sim tick (30 Hz, so at most one per frame at 60 fps, two after a stall) | 4 ms | `src/sim/step.bench.ts` via `task bench` |
| Pathfinding (part of the tick) | 4 ms for 40 searches on 48×32 | `src/sim/path.bench.ts` via `task bench` |
| Tiles | 4 ms | F3 overlay, `view.timings.tiles` |
| Entities and effects | 2 ms | F3 overlay, `view.timings.entities` |
| Lighting | 4 ms | F3 overlay, `view.timings.lighting` |
| HUD, log, manual portrait | 1 ms | F3 overlay |
| Headroom | ~1.7 ms | |

The two sim budgets are enforced: `task check` runs `task bench`, which fails
if either benchmark goes over. They run without coverage instrumentation,
which otherwise doubles the numbers. The render budgets are observed with the
F3 overlay (press F3 in game: fps, ms per frame and a rolling average per
subsystem) and are not yet enforced, because headless CI has no GPU-backed
canvas worth measuring.

## Where the time goes

**Pathfinding** was the first thing that went over. The POC rescanned the
whole grid per node; it now uses A* with a Manhattan heuristic on a typed-array
binary heap, with scratch buffers reused between searches so a search allocates
nothing. Paths are cached per entity and only re-planned when a tile within one
of the path (or the walker) changes, so a dig on the far side of the map does
not make everyone think again. Forty searches on 48×32 take about a
millisecond here.

**Tiles** are drawn every frame with no caching, roughly 1,500 `fillRect`s plus
the autotile edges. It is well inside budget on this hardware; the obvious next
step if it is not on yours is an offscreen tile layer redrawn only when the map
version changes (the sim already tracks `mapVersion` for the path cache).

**Lighting** is an offscreen light map at half resolution: an ambient fill
plus one radial gradient per light, composited with `multiply`. Half
resolution quarters the fill cost and the smoothing hides it. There are about
thirty lights on a busy map.

**Entities** are a sprite-sheet `drawImage` each plus a shadow, bars and
glyphs. Sorting by y for painter's order is a 60-element sort; nothing to see.

## Checking it

```sh
task bench          # sim tick and pathfinding budgets, with the numbers printed
task dev            # then press F3 in the game
```

The sandbox (title screen → Sandbox) is a 32×20 hall with an endless schedule,
which is the busiest the game gets without the editor.
