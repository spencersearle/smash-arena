# Smash Arena

A small **original platform fighter** in the spirit of Super Smash Bros — built with
vanilla JavaScript and HTML Canvas, no build step, no dependencies.

> Not affiliated with Nintendo. All characters and art are original placeholders;
> only the *genre mechanics* (damage-percent knockback, stocks, ring-outs) are borrowed.

## Play it

**Live:** https://spencersearle.github.io/smash-arena/

Or locally — just open `index.html` in any browser (or serve the folder).

## How it works

Two players share one keyboard. Land hits to raise your opponent's **damage %**.
The higher their %, the farther your attacks launch them. Knock them past the blast
zone to take a **stock**. Last fighter with stocks standing wins.

| Action      | Player 1 (Azure) | Player 2 (Ember) |
|-------------|------------------|------------------|
| Move        | `A` / `D`        | `←` / `→`        |
| Jump (×2)   | `W`              | `↑`              |
| Fast-fall   | `S`              | `↓`              |
| Light attack| `F`              | `.`              |
| Heavy attack| `G`              | `/`              |
| Start / rematch | `Enter`      | `Enter`          |

- **Light** — fast, low knockback poke. Good for racking up %.
- **Heavy** — slow, big launcher. Use it to finish at high %.

## Mechanics

- Gravity, double-jump, fast-fall, ground/air friction
- One main stage + three floating (land-on-top) platforms
- Damage-percent scaling: knockback = `base + percent × scale`
- 3 stocks each, respawn invulnerability, ring-out blast zones
- Hit-stun invulnerability so combos don't chain-lock

## Files

- `index.html` — page shell + control hints
- `style.css` — layout and framing
- `game.js` — the whole engine (input, physics, combat, render loop)

## License

MIT — see `LICENSE`.
