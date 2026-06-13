# Smash Arena

A full **original platform fighter** in the spirit of Super Smash Bros — built with
vanilla JavaScript and HTML Canvas. No build step, no dependencies, no asset files
(even the sound is synthesized at runtime).

> Not affiliated with Nintendo. All characters and art are original; only the
> *genre mechanics* (damage-percent knockback, stocks, ring-outs, shields) are borrowed.

## Play it

**Live:** https://spencersearle.github.io/smash-arena/

Or locally — just open `index.html` in any browser.

## Features

- **6 fighters**, each with distinct weight, speed, jump, power, and a unique special:
  - **Azure** — all-rounder, energy **Bolt** projectile
  - **Ember** — bruiser, close-range **Flare** burst
  - **Gale** — speedster, lunging **Dash**
  - **Terra** — heavyweight, ground-pound **Quake**
  - **Volt** — glass cannon, fast **Zap** projectile
  - **Frost** — floaty zoner, rising **Updraft** recovery
- **3 stages** with different platform layouts
- **Menus**: main menu, how-to-play, character select (two cursors), stage select
- **1 or 2 players** — toggle player 2 to a **CPU** opponent with its own AI
- **Directional attacks** — jab, side, up, down, and an aerial spike, based on the
  direction you hold
- **Shields** that absorb hits (and break if overused), **double-jump**, **fast-fall**,
  and **drop-through** platforms
- **Damage-percent knockback**, **stocks** (1–5, selectable), ring-out blast zones
- Particle hit-sparks, camera shake, KO flash, synthesized sound effects, pause menu

## Controls

| Action            | Player 1 | Player 2 |
|-------------------|----------|----------|
| Move              | `A` / `D`| `←` / `→`|
| Jump (double)     | `W`      | `↑`      |
| Drop / Fast-fall  | `S`      | `↓`      |
| Attack (+ a direction) | `F` | `/`      |
| Special           | `G`      | `.`      |
| Shield (hold)     | `E`      | `,`      |
| Select / Back / Pause | `Enter` / `Esc` | |

In character select, press **Tab** to toggle Player 2 to a CPU.

## How it works

Land hits to raise your opponent's **damage %**. The higher it climbs, the farther
your attacks launch them — knock them past the blast zone to take a **stock**. Last
fighter with stocks standing wins.

## Project layout

| File | Role |
|------|------|
| `index.html` | page shell, loads the modules in order |
| `style.css`  | layout and framing |
| `data.js`    | characters, stages, attack tables, config, helpers |
| `audio.js`   | WebAudio sound-effect synth |
| `engine.js`  | `SA.Match` — physics, combat, specials, projectiles, particles, CPU AI |
| `ui.js`      | all rendering: menus, character/stage select, HUD, world |
| `main.js`    | screen state machine, input → intents, game loop |

The code was verified with a headless harness that drives every screen and sweeps
every character/stage/attack through the engine, asserting core mechanics.

## License

MIT — see `LICENSE`.
