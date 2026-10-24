# Balance notes

The target for the Cairn (level 1, three waves) is that a first-time player
wins on the second attempt. We approximate "a first-time player on their
second attempt" with the scripted steward in `src/sim/bot.ts`: it digs out
room and a bent corridor, builds a Lair of 4 and a Hatchery of 2 before
anything else, then a Treasury, then grows, keeping a float of 30 gold for
wages once the first three rooms stand. It lays no clever traps and never
kites. `src/sim/balance.test.ts` plays twenty seeds and fails the build if
fewer than 60% of them survive the third wave.

## Where it landed

| Pass | Change | Survival (20 seeds) |
| --- | --- | --- |
| 0 | M1–M3 as first written | 6/20 (30%) |
| 1 | Wages halved; regeneration 0.25/s out of combat; meal heals 6, nap 15; bot keeps a 30g float | 9/20 (45%) |
| 2 | Cairn waves lose the reliquary bearer and one levy per wave; lord and bearer move to the Siege | 11/20 (55%) |
| 3 | Bot builds hound rooms before the vault | 9/20 (45%) — worse, see below |
| 4 | Angry creatures no longer sulk; first payday at 90s; regeneration 0.5/s | **16/20 (80%)** |

## What the traces showed

**Gold sat at zero all game.** Every pass before the fourth lost to the same
shape: the steward spends the purse on rooms, the first payday at 60s finds
nothing in the vault, and every creature is marked unpaid. Wages of 20 a hound
and 25 a Gwyllgi came to 130 a minute with a full hall, against a map that
holds about 675 gold in seams over its whole life. Halving wages was the
first fix and not enough on its own.

**Anger disarmed the hall.** The mood system made an angry creature "sulk":
it would only bother with a mortal within three tiles. Combined with the
unpaid flag that meant a missed payday turned every defender passive exactly
as the first wave walked past them to the Heart. Pass 3 made this worse, not
better, because building hound rooms first meant the vault was empty at the
60s payday in more seeds. The fix is that anger now stops a creature
regenerating instead of stopping it fighting, and the first payday waits
until 90s, after the first wave. Anger still matters: a creature that is
twice unpaid leaves, and a stewing one stays wounded.

**Defenders went into wave 2 still bleeding.** Hounds at 34 HP against
knights at 40 HP and 5 a blow are both glass; whichever side is fresher wins.
With 55s between waves and only meals and naps to heal, the hall's creatures
met the second wave at half strength. Regeneration of 0.5 HP/s out of combat
(not while angry) gives them back about 25 HP between waves.

**The reliquary bearer is a level-1 loss.** Nothing within two and a half
tiles of the bearer will fight; once he stands beside the Heart the whole
chamber is a hush and the knights strike freely. That is the right threat for
a later level with boulders and a Ceffyl Dŵr on hand, not for the Cairn. He
and the Cantref Lord now appear in the Siege schedule.

## Numbers changed

| Thing | Before | After | Why |
| --- | --- | --- | --- |
| Cŵn Annwn wage | 20 | 8 | 130/min was more than the map earns |
| Pwca wage | 10 | 4 | ditto |
| Gwyllgi wage | 25 | 12 | ditto |
| Ceffyl Dŵr wage | 30 | 15 | ditto |
| Afanc wage | 60 | 30 | ditto |
| First payday | 60s | 90s | after the first wave, not during it |
| Out-of-combat regeneration | none | 0.5 HP/s (not while angry) | defenders meet wave 2 fresh |
| Meal heal | 3 | 6 | |
| Nap heal | 10 | 15 | |
| Angry creatures | engage only within 3 tiles | engage normally, no regeneration | anger must not disarm the hall |
| Cairn wave 2 | K, P, K + 3 levies | K, P, K + 2 levies | |
| Cairn wave 3 | K, P, K, P + bearer | K, P, K, P + 2 levies | bearer moved to the Siege |

Starting gold stayed at 150 (raised from 120 in M1 so a Lair of 4, a Hatchery
of 2 and a one-tile Treasury are all affordable before the first payday).
Hero stats are untouched from the original brief.

## Still open

- The four losing seeds all die on wave 3 with no creatures left. A human
  who lays a snare and a pit in the corridor, or buys the ward, should do
  better than the bot; the bot only lays traps once it has 60 gold spare,
  which it rarely does.
- Waves currently arrive on a fixed clock. A short grace after a wave is
  cleared (say, never less than 30s) would smooth the unlucky seeds.
- Re-run `task test` after any stat change; the survival line is printed.
