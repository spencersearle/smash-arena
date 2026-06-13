/* Smash Arena — data layer.
 * Global namespace + config, characters, stages, attack/special tables, helpers.
 * Loaded first; everything else hangs off window.SA. */

window.SA = window.SA || {};

(() => {
  const SA = window.SA;

  SA.CONFIG = {
    W: 1280,
    H: 720,
    GRAVITY: 0.62,
    MAX_FALL: 17,
    GROUND_FRICTION: 0.80,
    AIR_FRICTION: 0.95,
    RESPAWN_FRAMES: 80,
    INVULN_FRAMES: 110,
    HITSTUN_INVULN: 12,   // brief i-frames after a hit so combos don't chain-lock forever
    SHIELD_MAX: 100,
    SHIELD_REGEN: 0.35,
    SHIELD_DRAIN: 0.55,
    SHIELD_BREAK_STUN: 90,
    DEFAULT_STOCKS: 3,
  };

  // ---- Helpers ------------------------------------------------------------
  SA.util = {
    clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
    aabb: (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y,
    rand: (a, b) => a + Math.random() * (b - a),
    // launch vector from an angle (deg) and magnitude, mirrored by facing.
    launch: (angleDeg, mag, facing) => {
      const r = (angleDeg * Math.PI) / 180;
      return { x: Math.cos(r) * mag * facing, y: -Math.sin(r) * mag };
    },
  };

  // ---- Attacks (shared move set, scaled per character power) --------------
  // angle: launch direction in degrees (90 = straight up, negative = spike).
  // reach/h: hitbox size. ox/oy: offset from fighter center (ox mirrored by facing).
  SA.ATTACKS = {
    jab:  { dmg: 4,  base: 4.0,  scale: 0.08, angle: 40,  reach: 56, h: 56, ox: 30, oy: -4,  startup: 3,  active: 5,  cooldown: 12, name: "Jab" },
    side: { dmg: 10, base: 6.2,  scale: 0.135, angle: 32, reach: 78, h: 70, ox: 42, oy: -2,  startup: 8,  active: 6,  cooldown: 26, name: "Side" },
    up:   { dmg: 9,  base: 5.6,  scale: 0.150, angle: 80, reach: 66, h: 86, ox: 6,  oy: -54, startup: 6,  active: 6,  cooldown: 24, name: "Up" },
    down: { dmg: 8,  base: 5.0,  scale: 0.120, angle: 18, reach: 80, h: 44, ox: 30, oy: 30,  startup: 6,  active: 6,  cooldown: 24, name: "Down" },
    dair: { dmg: 9,  base: 4.6,  scale: 0.110, angle: -62, reach: 56, h: 70, ox: 10, oy: 28, startup: 8,  active: 8,  cooldown: 30, name: "Spike" },
  };

  // ---- Characters ---------------------------------------------------------
  // weight: higher = harder to launch. speed/jump are multipliers on the base.
  // power: multiplier on attack damage + knockback. special: see engine.js.
  SA.CHARACTERS = [
    {
      id: "azure", name: "AZURE", blurb: "All-rounder. No weak spots.",
      color: "#4ea8ff", dark: "#1c4f8a", accent: "#bfe2ff",
      weight: 1.00, speed: 1.00, jump: 1.00, fall: 1.00, power: 1.00,
      special: { kind: "projectile", name: "Bolt", dmg: 7, base: 5, scale: 0.10, angle: 18, speed: 12, radius: 12, life: 70, cooldown: 36, color: "#bfe2ff" },
    },
    {
      id: "ember", name: "EMBER", blurb: "Bruiser. Hits like a truck up close.",
      color: "#ff6b5e", dark: "#8a2b22", accent: "#ffd0c8",
      weight: 1.15, speed: 0.90, jump: 0.96, fall: 1.05, power: 1.18,
      special: { kind: "burst", name: "Flare", dmg: 14, base: 9, scale: 0.20, angle: 42, reach: 92, h: 96, cooldown: 50, color: "#ffb24a" },
    },
    {
      id: "gale", name: "GALE", blurb: "Speedster. Fast but flies far when hit.",
      color: "#57e08a", dark: "#1f7a44", accent: "#c9f7da",
      weight: 0.82, speed: 1.26, jump: 1.10, fall: 0.96, power: 0.92,
      special: { kind: "dash", name: "Dash", dmg: 8, base: 6, scale: 0.10, angle: 22, speed: 17, dur: 12, cooldown: 44, color: "#c9f7da" },
    },
    {
      id: "terra", name: "TERRA", blurb: "Heavyweight. Slow, tough, devastating.",
      color: "#e0973f", dark: "#7a4f1c", accent: "#f7dcae",
      weight: 1.38, speed: 0.78, jump: 0.86, fall: 1.18, power: 1.22,
      special: { kind: "quake", name: "Quake", dmg: 12, base: 8, scale: 0.16, angle: 70, radius: 150, cooldown: 60, color: "#f7c98a" },
    },
    {
      id: "volt", name: "VOLT", blurb: "Glass cannon. Big damage, light frame.",
      color: "#ffd34e", dark: "#9a7a1c", accent: "#fff1bf",
      weight: 0.80, speed: 1.16, jump: 1.05, fall: 1.00, power: 1.05,
      special: { kind: "projectile", name: "Zap", dmg: 6, base: 4.5, scale: 0.09, angle: 8, speed: 18, radius: 9, life: 55, cooldown: 28, color: "#fff1bf" },
    },
    {
      id: "frost", name: "FROST", blurb: "Floaty zoner. Strong recovery.",
      color: "#67e0e0", dark: "#1f7a7a", accent: "#cdf7f7",
      weight: 0.95, speed: 0.95, jump: 1.16, fall: 0.82, power: 0.96,
      special: { kind: "rising", name: "Updraft", dmg: 9, base: 6, scale: 0.12, angle: 86, vy: -15, reach: 64, h: 96, cooldown: 46, color: "#cdf7f7" },
    },
  ];

  // ---- Stages -------------------------------------------------------------
  // Each: name, sky gradient, platform list, spawn points, blast margins.
  // Platform.solid=true blocks from all sides; false = land-on-top only.
  const W = SA.CONFIG.W, H = SA.CONFIG.H;
  SA.STAGES = [
    {
      id: "battlefield", name: "BATTLEFIELD",
      sky: ["#1a2336", "#141b2b", "#0c111c"],
      glow: "rgba(78,168,255,0.10)",
      platforms: [
        { x: 290, y: 560, w: 700, h: 40, solid: true },
        { x: 360, y: 410, w: 200, h: 20, solid: false },
        { x: 720, y: 410, w: 200, h: 20, solid: false },
        { x: 540, y: 300, w: 200, h: 20, solid: false },
      ],
      spawns: [{ x: 470, y: 300 }, { x: 760, y: 300 }],
      blast: { top: -170, bottom: 220, left: -210, right: 210 },
    },
    {
      id: "expanse", name: "THE EXPANSE",
      sky: ["#26203a", "#191430", "#0b0816"],
      glow: "rgba(170,120,255,0.10)",
      platforms: [
        { x: 230, y: 560, w: 820, h: 40, solid: true },
      ],
      spawns: [{ x: 430, y: 360 }, { x: 800, y: 360 }],
      blast: { top: -190, bottom: 220, left: -190, right: 190 },
    },
    {
      id: "skyloft", name: "SKYLOFT",
      sky: ["#3a2a1f", "#241a16", "#100a08"],
      glow: "rgba(255,170,90,0.10)",
      platforms: [
        { x: 470, y: 540, w: 340, h: 36, solid: true },
        { x: 150, y: 430, w: 200, h: 20, solid: false },
        { x: 930, y: 430, w: 200, h: 20, solid: false },
        { x: 540, y: 320, w: 200, h: 20, solid: false },
      ],
      spawns: [{ x: 560, y: 300 }, { x: 700, y: 300 }],
      blast: { top: -170, bottom: 240, left: -220, right: 220 },
    },
  ];

  // Per-player default control maps (used by main.js to build intents).
  SA.CONTROLS = [
    { id: 0, name: "P1", left: "a", right: "d", up: "w", down: "s", attack: "f", special: "g", shield: "e" },
    { id: 1, name: "P2", left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown", attack: "/", special: ".", shield: "," },
  ];
})();
