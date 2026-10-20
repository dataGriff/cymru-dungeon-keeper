# Steward of Annwn

A Dungeon Keeper-style proof of concept in Welsh myth. Arawn, lord of Annwn, rides with the Wild Hunt and has left you the keys to his underground hall. Mortals have heard he is gone and come down the stair to strike the Heart. Keep it beating through three waves.

Vite + TypeScript, plain Canvas 2D, no engine, no runtime dependencies. One static page that could later be wrapped by Tauri.

## Screenshots

_Placeholder. Drop captures into `docs/` and reference them here._

| The hall | The manual |
| --- | --- |
| `docs/hall.png` | `docs/manual.png` |

## Running it

Needs [mise](https://mise.jdx.dev) (or node 22 + [go-task](https://taskfile.dev) installed by hand).

```sh
mise install        # node + task, pinned in .mise.toml
task dev            # serve with hot reload
task check          # lint + test + bench + build (what CI runs)
task sprites        # re-render art/figures.json into public/sprites.png
task --list         # everything else
```

## Controls

| Action | How |
| --- | --- |
| Pick a tool | Toolbar buttons, or keys `1` Dig · `2` Lair · `3` Hatchery · `4` Treasury |
| Mark rock for digging | Dig tool: click or drag across rock. Click a marked tile to unmark it. |
| Build a room | Room tool: click a floor tile. Lair 15g, Hatchery 25g, Treasury 30g. |
| Sell a room | Click a tile of that room with the same tool. You get half back. |
| Read about a creature | Click it on the board, or use the tabs on the manual page. |
| Sound | The "Sound" button. It must be a click; browsers insist. |

## How the hall works

- **Coblynau** dig what you mark. Gold seams pay 25. They flee heroes, gather the gold dead heroes drop, and are replaced from the Portal while fewer than three remain.
- **Creatures** arrive through the Portal every 7 seconds if the rooms are right: a **Cŵn Annwn** wants a Lair of 4 and a Hatchery of 2; a **Pwca** wants a Lair of 2 and a Treasury of 2; the **Afanc** wants a Lair of 9, a Treasury of 4 and 300 gold in hand. They eat, sleep, and rush any mortal within seven tiles. Starve them and they leave.
- **Mortals** come through the Gate on the far right: the first wave at 40 seconds, then every 55. Wave n brings 1+n of them, and from the second wave every second one is a Hedge-Priest who heals knights. They walk to the Heart, tunnelling through rock at a quarter speed if you give them no corridor.
- **Win** by clearing the third wave. **Lose** when the Heart's 100 points reach zero.

## Layout

```
src/sim/      pure game logic, no DOM, covered by Vitest (incl. a scripted steward for balance)
src/render/   canvas drawing, sprite sheet + rectangle fallback (drawBeast), coloured light map
src/ui/       HUD, toolbar, log, manual panel, overlay, audio and mixer
src/data/     bestiary.ts (every creature, engine and trade in one typed object), waves.ts
art/          figures.json: the sprite source; scripts/build-sprites.mjs renders the sheet
docs/         backlog.md, balance.md
src/main.ts   wiring and the game loop
```

Tests run against `src/sim` only, with a coverage gate of 80% and a
pathfinding budget enforced by `task bench`. `docs/balance.md` records the
tuning passes; `src/sim/balance.test.ts` fails the build if the scripted
steward survives fewer than 60% of seeds.

## Sound

The Sound button starts three detuned drones and the roof drips; the Mixer
below the toolbar has master, ambient and effects sliders. Hounds bay when
they take up a chase, quieter the closer they are; picks ring on stone;
the Heart tolls when struck; mortal footsteps are louder in open halls.

## Next

The backlog lives in `docs/backlog.md` and as GitHub issues with milestones.
Remaining after M4: the printable manual and reference card, the box mock,
the title screen, the campaign and level format, save/load, the sandbox
editor, the Tauri wrapper, profiling, accessibility, the itch.io page and
the devlog.
