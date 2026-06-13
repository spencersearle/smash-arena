/* Smash Arena — a small original platform fighter.
 * Vanilla JS + Canvas. No build step: open index.html or serve statically.
 * Two local players, damage-percent knockback, stocks, one stage. */

(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;   // 1280
  const H = canvas.height;  // 720

  // ---- Tuning -------------------------------------------------------------
  const GRAVITY = 0.62;
  const MAX_FALL = 17;
  const MOVE_ACCEL = 1.1;
  const MAX_RUN = 6.2;
  const GROUND_FRICTION = 0.78;
  const AIR_FRICTION = 0.94;
  const JUMP_V = -13.2;
  const DOUBLE_JUMP_V = -12.2;
  const FAST_FALL = 1.7;
  const RESPAWN_FRAMES = 90;
  const INVULN_FRAMES = 110;
  const START_STOCKS = 3;

  // Attack archetypes: light = quick poke, heavy = slow launcher.
  const ATTACKS = {
    light: { damage: 5,  base: 5.0,  scale: 0.10, lift: 4.0,  reach: 58, h: 70, startup: 4,  active: 6,  cooldown: 16, hitstunV: 0 },
    heavy: { damage: 13, base: 8.5,  scale: 0.20, lift: 7.5,  reach: 74, h: 96, startup: 9,  active: 7,  cooldown: 34, hitstunV: 0 },
  };

  // ---- Stage --------------------------------------------------------------
  // Main platform plus two floating platforms. Floating ones are land-on-top.
  const platforms = [
    { x: 240,  y: 560, w: 800, h: 40, solid: true  },  // main ground
    { x: 200,  y: 400, w: 220, h: 22, solid: false },  // left float
    { x: 860,  y: 400, w: 220, h: 22, solid: false },  // right float
    { x: 540,  y: 290, w: 200, h: 22, solid: false },  // top float
  ];
  const BLAST_TOP = -160, BLAST_BOTTOM = H + 180, BLAST_LEFT = -200, BLAST_RIGHT = W + 200;

  // ---- Input --------------------------------------------------------------
  const keys = new Set();
  const pressedThisFrame = new Set();
  window.addEventListener("keydown", (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!keys.has(k)) pressedThisFrame.add(k);
    keys.add(k);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "/"].includes(e.key)) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    keys.delete(k);
  });

  // ---- Fighter ------------------------------------------------------------
  class Fighter {
    constructor(cfg) {
      this.name = cfg.name;
      this.color = cfg.color;
      this.dark = cfg.dark;
      this.controls = cfg.controls;
      this.spawn = cfg.spawn;
      this.w = 46;
      this.h = 64;
      this.reset(true);
      this.stocks = START_STOCKS;
    }
    reset(full) {
      this.x = this.spawn.x;
      this.y = this.spawn.y;
      this.vx = 0;
      this.vy = 0;
      this.facing = this.spawn.facing;
      this.onGround = false;
      this.jumps = 2;
      this.damage = full ? 0 : this.damage;
      this.attack = null;         // { type, frame, hit:Set }
      this.cooldown = 0;
      this.invuln = full ? 0 : INVULN_FRAMES;
      this.respawn = 0;
    }
    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
  }

  // ---- Game state ---------------------------------------------------------
  let fighters = [];
  let state = "title";   // title | playing | over
  let winner = null;
  let shake = 0;
  let frame = 0;

  function newMatch() {
    fighters = [
      new Fighter({
        name: "AZURE", color: "#4ea8ff", dark: "#1c4f8a",
        controls: { left: "a", right: "d", up: "w", down: "s", light: "f", heavy: "g" },
        spawn: { x: 430, y: 300, facing: 1 },
      }),
      new Fighter({
        name: "EMBER", color: "#ff6b5e", dark: "#8a2b22",
        controls: { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown", light: ".", heavy: "/" },
        spawn: { x: 800, y: 300, facing: -1 },
      }),
    ];
    winner = null;
    state = "playing";
  }

  // ---- Physics & collision ------------------------------------------------
  function landingY(p) { return p.y - 64; }

  function moveAndCollide(f) {
    f.x += f.vx;
    // Open arena: no side walls, only platform tops/heads matter.
    const prevBottom = f.y + f.h; // foot position before vertical move
    f.y += f.vy;

    f.onGround = false;
    for (const p of platforms) {
      const overlapX = f.x + f.w > p.x && f.x < p.x + p.w;
      if (!overlapX) continue;
      const foot = f.y + f.h;
      if (f.vy >= 0 && foot >= p.y && prevBottom <= p.y + 14) {
        // landing on top
        if (p.solid || foot - p.y < 24) {
          f.y = p.y - f.h;
          f.vy = 0;
          f.onGround = true;
          f.jumps = 2;
        }
      } else if (p.solid && f.vy < 0 && f.y < p.y + p.h && f.y > p.y && (f.x + f.w > p.x && f.x < p.x + p.w)) {
        // bonk head on solid only
        f.y = p.y + p.h;
        f.vy = 0;
      }
    }
  }

  function offStage(f) {
    return f.cx < BLAST_LEFT || f.cx > BLAST_RIGHT || f.y > BLAST_BOTTOM || f.y + f.h < BLAST_TOP;
  }

  // ---- Per-fighter step ---------------------------------------------------
  function stepFighter(f, other) {
    if (f.respawn > 0) { f.respawn--; if (f.respawn === 0) f.reset(false); return; }

    const c = f.controls;
    const left = keys.has(c.left), right = keys.has(c.right);

    // horizontal
    if (left && !right) { f.vx -= MOVE_ACCEL; f.facing = -1; }
    else if (right && !left) { f.vx += MOVE_ACCEL; f.facing = 1; }
    else f.vx *= f.onGround ? GROUND_FRICTION : AIR_FRICTION;
    f.vx = Math.max(-MAX_RUN, Math.min(MAX_RUN, f.vx));

    // jump (rising edge)
    if (pressedThisFrame.has(c.up)) {
      if (f.onGround) { f.vy = JUMP_V; f.onGround = false; f.jumps = 1; }
      else if (f.jumps > 0) { f.vy = DOUBLE_JUMP_V; f.jumps--; }
    }
    // fast fall
    if (keys.has(c.down) && f.vy > 0) f.vy += FAST_FALL;

    // gravity
    f.vy = Math.min(MAX_FALL, f.vy + GRAVITY);

    moveAndCollide(f);

    // attacks
    if (f.cooldown > 0) f.cooldown--;
    if (!f.attack && f.cooldown === 0) {
      if (pressedThisFrame.has(c.light)) startAttack(f, "light");
      else if (pressedThisFrame.has(c.heavy)) startAttack(f, "heavy");
    }
    if (f.attack) updateAttack(f, other);

    if (f.invuln > 0) f.invuln--;

    if (offStage(f)) loseStock(f);
  }

  function startAttack(f, type) {
    f.attack = { type, frame: 0, hit: false };
    f.cooldown = ATTACKS[type].cooldown;
  }

  function attackBox(f) {
    const a = ATTACKS[f.attack.type];
    const x = f.facing === 1 ? f.x + f.w : f.x - a.reach;
    const y = f.cy - a.h / 2;
    return { x, y, w: a.reach, h: a.h };
  }

  function updateAttack(f, other) {
    const a = ATTACKS[f.attack.type];
    f.attack.frame++;
    const fr = f.attack.frame;
    const active = fr > a.startup && fr <= a.startup + a.active;
    if (active && !f.attack.hit && other.respawn === 0 && other.invuln === 0) {
      const box = attackBox(f);
      if (aabb(box, { x: other.x, y: other.y, w: other.w, h: other.h })) {
        applyHit(f, other, a);
        f.attack.hit = true;
      }
    }
    if (fr > a.startup + a.active) f.attack = null;
  }

  function applyHit(attacker, victim, a) {
    victim.damage += a.damage;
    const power = a.base + (victim.damage * a.scale);
    const dir = attacker.facing;
    victim.vx = dir * power;
    victim.vy = -(a.lift + power * 0.45);
    victim.invuln = 14;            // brief so combos don't chain-lock
    shake = Math.min(16, 6 + power);
  }

  function loseStock(f) {
    f.stocks--;
    shake = 14;
    if (f.stocks <= 0) {
      state = "over";
      winner = fighters.find((x) => x !== f);
    } else {
      f.respawn = RESPAWN_FRAMES;
      f.x = -9999; // hide during respawn
    }
  }

  // ---- Helpers ------------------------------------------------------------
  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ---- Rendering ----------------------------------------------------------
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1a2336");
    g.addColorStop(0.55, "#141b2b");
    g.addColorStop(1, "#0c111c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // distant glow
    const r = ctx.createRadialGradient(W / 2, H * 0.42, 60, W / 2, H * 0.42, 620);
    r.addColorStop(0, "rgba(78,168,255,0.10)");
    r.addColorStop(1, "rgba(78,168,255,0)");
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, W, H);
  }

  function drawPlatform(p) {
    const r = 10;
    ctx.fillStyle = p.solid ? "#2c3954" : "#26324a";
    roundRect(p.x, p.y, p.w, p.h, r);
    ctx.fill();
    // top edge highlight
    ctx.fillStyle = "rgba(120,160,220,0.45)";
    roundRect(p.x, p.y, p.w, 5, r);
    ctx.fill();
  }

  function drawFighter(f) {
    if (f.respawn > 0) return;
    const blink = f.invuln > 0 && Math.floor(frame / 4) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = blink ? 0.4 : 1;

    // body
    ctx.fillStyle = f.color;
    roundRect(f.x, f.y, f.w, f.h, 12);
    ctx.fill();
    ctx.fillStyle = f.dark;
    roundRect(f.x, f.y + f.h - 16, f.w, 16, 12);
    ctx.fill();

    // eyes (face direction)
    ctx.fillStyle = "#0d1018";
    const ex = f.facing === 1 ? f.x + f.w - 18 : f.x + 10;
    ctx.fillRect(ex, f.y + 16, 8, 10);
    ctx.fillRect(ex + (f.facing === 1 ? -12 : 12), f.y + 16, 8, 10);

    // attack swing
    if (f.attack) {
      const a = ATTACKS[f.attack.type];
      const fr = f.attack.frame;
      const active = fr > a.startup && fr <= a.startup + a.active;
      const box = attackBox(f);
      ctx.fillStyle = active
        ? (f.attack.type === "heavy" ? "rgba(255,210,90,0.85)" : "rgba(255,255,255,0.8)")
        : "rgba(255,255,255,0.18)";
      roundRect(box.x, box.y, box.w, box.h, 10);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawHUD() {
    const slots = [
      { f: fighters[0], x: W * 0.30 },
      { f: fighters[1], x: W * 0.70 },
    ];
    for (const s of slots) {
      const f = s.f;
      ctx.textAlign = "center";
      ctx.fillStyle = f.color;
      ctx.font = "700 22px Segoe UI, sans-serif";
      ctx.fillText(f.name, s.x, H - 86);

      // damage percent, color shifts redder with damage
      const pct = Math.round(f.damage);
      const heat = Math.min(1, f.damage / 150);
      ctx.fillStyle = `rgb(${230}, ${Math.round(230 - heat * 180)}, ${Math.round(230 - heat * 210)})`;
      ctx.font = "800 56px Segoe UI, sans-serif";
      ctx.fillText(`${pct}%`, s.x, H - 34);

      // stock pips
      for (let i = 0; i < f.stocks; i++) {
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(s.x - (f.stocks - 1) * 11 + i * 22, H - 96, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawTitle() {
    ctx.fillStyle = "rgba(8,11,18,0.78)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#e7ecf5";
    ctx.font = "800 84px Segoe UI, sans-serif";
    ctx.fillText("SMASH ARENA", W / 2, H / 2 - 70);
    ctx.fillStyle = "#8fa6c8";
    ctx.font = "400 24px Segoe UI, sans-serif";
    ctx.fillText("A two-player platform fighter — knock your rival off the stage.", W / 2, H / 2 - 18);
    ctx.fillStyle = "#4ea8ff";
    ctx.font = "700 30px Segoe UI, sans-serif";
    const pulse = 0.5 + 0.5 * Math.sin(frame / 18);
    ctx.globalAlpha = 0.55 + pulse * 0.45;
    ctx.fillText("Press ENTER to fight", W / 2, H / 2 + 60);
    ctx.globalAlpha = 1;
  }

  function drawOver() {
    ctx.fillStyle = "rgba(8,11,18,0.8)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = winner ? winner.color : "#fff";
    ctx.font = "800 76px Segoe UI, sans-serif";
    ctx.fillText(`${winner ? winner.name : "?"} WINS`, W / 2, H / 2 - 20);
    ctx.fillStyle = "#9fb0cc";
    ctx.font = "400 26px Segoe UI, sans-serif";
    ctx.fillText("Press ENTER for a rematch", W / 2, H / 2 + 40);
  }

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---- Main loop ----------------------------------------------------------
  function loop() {
    frame++;

    // Enter starts a match from the title or over screens.
    if (pressedThisFrame.has("Enter") && (state === "title" || state === "over")) {
      newMatch();
    }

    if (state === "playing") {
      stepFighter(fighters[0], fighters[1]);
      stepFighter(fighters[1], fighters[0]);
    }

    // camera shake
    ctx.save();
    if (shake > 0.4) {
      const s = shake;
      ctx.translate((Math.sin(frame * 7.3) * s), (Math.cos(frame * 6.1) * s));
      shake *= 0.85;
    } else shake = 0;

    drawBackground();
    for (const p of platforms) drawPlatform(p);
    if (fighters.length) {
      for (const f of fighters) drawFighter(f);
      drawHUD();
    }
    ctx.restore();

    if (state === "title") drawTitle();
    if (state === "over") drawOver();

    pressedThisFrame.clear();
    requestAnimationFrame(loop);
  }

  loop();
})();
