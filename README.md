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
task check          # lint + test + build
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
src/sim/      pure game logic, no DOM, covered by Vitest
src/render/   canvas drawing, pixel sprites (drawBeast), lighting pass
src/ui/       HUD, toolbar, log, manual panel, overlay, audio
src/data/     bestiary.ts: every creature's text and stats in one typed object
src/main.ts   wiring and the game loop
```

Tests run against `src/sim` only: Dijkstra, arrival rules, hunger, waves and win/lose, economy.

## Next

- Real sprite sheet. `drawBeast` already sits behind a `BeastRenderer` interface; implement it over a sheet and call `setBeastRenderer`.
- Printable manual PDF generated from `bestiary.ts`.
- Box front/back mock.
- Tauri wrapper around the built `dist/`.
