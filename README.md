# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/konongxyz/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/konongxyz/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the browser, built for make.fun's gta6-01 bounty. You are **Mari Voss**, newly arrived in the sun-soaked port city of Port Solano with $120, a borrowed shirt and a brother's worth of bad luck. Fixer **Dex Marlowe** has work. Mechanic **Tito Ferreira** has cars. The Solano Police Department has opinions. Seven story jobs carry Mari from courier runs to a four-star escape across the whole map — and after the story, the city stays open: courier fares, hidden cash packages, and every car on the street is still stealable.

## Run it

```sh
node serve.ts            # then open http://localhost:8080
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=9m688dgh&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

An open-world crime game in the browser, built for make.fun's gta6-01 bounty. You
are **Mari Voss**, newly arrived in the sun-soaked port city of Port Solano with
$120, a borrowed shirt and a brother's worth of bad luck. Fixer **Dex Marlowe** has
work. Mechanic **Tito Ferreira** has cars. The Solano Police Department has
opinions. Seven story jobs carry Mari from courier runs to a four-star escape
across the whole map — and after the story, the city stays open: courier fares,
hidden cash packages, and every car on the street is still stealable.

Everything is original: the city, the people, the cars, the story, the art and the
synthesized sound were all made for this game. It runs entirely from the static
files in `game/` — no build step, no network, nothing to install.

## Run it

Serve `game/` with any static file server and open `index.html` in desktop
Chrome, or use the bundled development server (Node 22):

```
node serve.ts            # then open http://localhost:8080
```

Hand the entry in the way the grader does:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes
`dossier.json` there with the vendored make.fun library in `vendor/`.

## Play it

- **W A S D / arrows** — walk and drive · **Shift** — run
- **E** — enter and exit cars (walk up to one; occupied cars can be carjacked)
- **Space** — handbrake · **Mouse** — aim · **Click / F** — punch, or shoot with
  the weapon in hand (the pistol is earned in the second story job)
- **Tab** — weapon wheel · **Q** — swap weapon · **B** — buy a weapon at Anchor Arms
- **R** — radio (in a car) · **G** — Tito's garage at his forecourt / start the Marina Mile at the Boardwalk Stage
- **P / Esc** — pause · **M** — mute

Systems in the city: a five-star wanted ladder that only rises when a crime is
witnessed (by an officer, or by a bystander near one) and fades when you break
sight; police Interceptors that pursue, ram, and put officers on foot who will
bust you if they can hold you still — or shoot at three stars and up; at three stars and up, Interceptor roadblocks seal the road ahead; at four stars an SPD helicopter joins the hunt and, while its searchlight holds you, the heat cannot fade; traffic
that drives the grid in right-hand lanes and yields; pedestrians who stroll,
flee, and occasionally fight back; car damage, smoke and wrecks; a day-night
cycle; fares that pay by distance with tips for speed; a hospital that patches
you up and a gun store that sells rounds; and a save that survives the tab.

Round six adds the systems the top of the board runs: an **arsenal of six
weapons** (fists, lead pipe, 9mm, SMG, shotgun, assault rifle) behind a
selection wheel; a **car radio** with three named synthesized stations;
a **respect ladder** of nine titled ranks earned from jobs, fares and races;
**Tito's garage** selling engine tunes, armour plating, repairs and resprays;
the **Marina Mile**, a six-gate street race against two rival drivers; and a
**Showcase** state on the title screen that drops you into the city at full
heat — four stars, helicopter overhead, roadblock ahead, every system live.

## Layout

- `game/index.html` — the page; `game/style.css` — the page chrome
- `game/src/core/` — `main.js` (the loop and the wiring), `config.js`, `random.js`, `input.js`, `save.js`
- `game/src/world/` — `world.js` (Port Solano itself), `render.js` (the world on canvas)
- `game/src/vehicles/vehicles.js` — driving and traffic · `game/src/people/people.js` — pedestrians and Mari
- `game/src/police/police.js` — the wanted system and the law · `game/src/combat/combat.js` — the arsenal at work
- `game/src/missions/missions.js` — the seven story jobs, fares and pickups
- `game/src/systems/` — `weapons.js` (the arsenal and its wheel), `radio.js` (three stations), `reputation.js` (respect ranks), `garage.js` (Tito's services), `race.js` (the Marina Mile)
- `game/src/audio/audio.js` — synthesized sound · `game/src/ui/hud.js` — HUD, minimap, menus, the wheel
- `game/src/showcase/scenes.js` — the staged scenes behind `screenshots/`, and the Showcase state
- `main.ts` — the hand-in program · `vendor/makefun-game.ts` — the kit's library

## License

MIT — see `LICENSE`.
