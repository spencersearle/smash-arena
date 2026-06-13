/* Smash Arena — engine.
 * SA.Match owns the whole in-game simulation: fighters, projectiles, particles,
 * physics, combat, specials, KOs. main.js feeds it per-frame intents; ui.js draws it. */

(() => {
  const SA = window.SA;
  const C = SA.CONFIG;
  const U = SA.util;

  // Base movement (before per-character multipliers).
  const MOVE_ACCEL = 1.10;
  const MAX_RUN = 6.0;
  const JUMP_V = -13.2;
  const DJUMP_V = -12.0;
  const FAST_FALL = 1.6;

  // Generous absolute blast bounds (world coords); same feel on every stage.
  const DEATH = { left: -190, right: C.W + 190, top: -210, bottom: C.H + 200 };

  // ---- Fighter ------------------------------------------------------------
  class Fighter {
    constructor(match, charDef, slot) {
      this.match = match;
      this.char = charDef;
      this.slot = slot;            // 0 or 1
      this.name = charDef.name;
      this.color = charDef.color;
      this.dark = charDef.dark;
      this.accent = charDef.accent;
      this.w = 46;
      this.h = 64;
      this.stocks = match.stocks;
      const sp = match.stage.spawns[slot];
      this.spawn = { x: sp.x, y: sp.y };
      this.facing = slot === 0 ? 1 : -1;
      this.resetState(true);
    }

    resetState(full) {
      this.x = this.spawn.x;
      this.y = this.spawn.y;
      this.vx = 0;
      this.vy = 0;
      this.onGround = false;
      this.jumps = 2;
      if (full) this.damage = 0;
      this.attack = null;          // { def, frame, hit, follow }
      this.cooldown = 0;
      this.specialCD = 0;
      this.invuln = full ? 0 : C.INVULN_FRAMES;
      this.respawn = 0;
      this.hitstun = 0;
      this.shield = C.SHIELD_MAX;
      this.shielding = false;
      this.shieldBroken = 0;
      this.dropTimer = 0;
      this.dashTimer = 0;
      this._ai = { left: false, right: false, up: false, attack: false, special: false, shield: false, timer: 0, mood: 0 };
    }

    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    box() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
    alive() { return this.respawn === 0; }
  }

  // ---- Projectile ---------------------------------------------------------
  class Projectile {
    constructor(owner, def, dir) {
      this.owner = owner;
      this.def = def;
      this.x = owner.cx + dir * 30;
      this.y = owner.cy - 6;
      this.vx = dir * def.speed;
      this.vy = 0;
      this.dir = dir;
      this.r = def.radius;
      this.life = def.life;
      this.color = def.color;
      this.dead = false;
    }
  }

  // ---- Particle -----------------------------------------------------------
  class Particle {
    constructor(x, y, vx, vy, life, color, size, grav) {
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.life = life; this.maxLife = life; this.color = color;
      this.size = size; this.grav = grav == null ? 0.15 : grav;
    }
  }

  // ---- Match --------------------------------------------------------------
  class Match {
    constructor(charA, charB, stage, stocks) {
      this.stage = stage;
      this.stocks = stocks || C.DEFAULT_STOCKS;
      this.fighters = [new Fighter(this, charA, 0), new Fighter(this, charB, 1)];
      this.projectiles = [];
      this.particles = [];
      this.state = "fight";        // fight | over
      this.winner = null;
      this.shake = 0;
      this.frame = 0;
      this.koFlash = 0;
      this.main = stage.platforms[0]; // first platform is the main ground
    }

    // intents: [intentA, intentB], each { left,right,up,down,attack,special,shield,
    //   jumpPressed, attackPressed, specialPressed }
    update(intents) {
      this.frame++;
      if (this.state === "fight") {
        this.stepFighter(this.fighters[0], this.fighters[1], intents[0]);
        this.stepFighter(this.fighters[1], this.fighters[0], intents[1]);
        this.stepProjectiles();
      }
      this.stepParticles();
      if (this.shake > 0.3) this.shake *= 0.85; else this.shake = 0;
      if (this.koFlash > 0) this.koFlash--;
    }

    // ---- Particles helpers ----
    addParticles(x, y, color, count, spread, opts) {
      opts = opts || {};
      for (let i = 0; i < count; i++) {
        const a = U.rand(0, Math.PI * 2);
        const s = U.rand(spread * 0.3, spread);
        this.particles.push(new Particle(
          x, y, Math.cos(a) * s, Math.sin(a) * s,
          U.rand(opts.life || 14, (opts.life || 14) + 12),
          color, U.rand(opts.size || 2, (opts.size || 2) + 3),
          opts.grav == null ? 0.15 : opts.grav
        ));
      }
    }

    stepParticles() {
      const ps = this.particles;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.x += p.vx; p.y += p.vy; p.vy += p.grav; p.vx *= 0.96; p.life--;
        if (p.life <= 0) ps.splice(i, 1);
      }
    }

    // ---- Fighter step ----
    stepFighter(f, foe, intent) {
      if (f.respawn > 0) {
        f.respawn--;
        if (f.respawn === 0) f.resetState(false);
        return;
      }
      if (f.shieldBroken > 0) { f.shieldBroken--; intent = ZERO_INTENT; }

      const ch = f.char;
      const controllable = f.hitstun <= 0 && f.shieldBroken <= 0;

      // ---- Shield ----
      f.shielding = false;
      if (controllable && intent.shield && f.onGround && f.shield > 4) {
        f.shielding = true;
        f.shield = Math.max(0, f.shield - C.SHIELD_DRAIN);
        if (f.shield <= 0) { f.shieldBroken = C.SHIELD_BREAK_STUN; f.shield = 0; SA.Audio.shieldBreak(); }
      } else if (f.shield < C.SHIELD_MAX) {
        f.shield = Math.min(C.SHIELD_MAX, f.shield + C.SHIELD_REGEN);
      }

      // ---- Horizontal movement ----
      if (controllable && !f.shielding) {
        const accel = MOVE_ACCEL * ch.speed;
        const maxRun = MAX_RUN * ch.speed;
        if (intent.left && !intent.right) { f.vx -= accel; f.facing = -1; }
        else if (intent.right && !intent.left) { f.vx += accel; f.facing = 1; }
        else f.vx *= f.onGround ? C.GROUND_FRICTION : C.AIR_FRICTION;
        f.vx = U.clamp(f.vx, -maxRun, maxRun);
      } else {
        f.vx *= f.onGround ? C.GROUND_FRICTION : C.AIR_FRICTION;
      }

      // ---- Jump ----
      if (controllable && !f.shielding && intent.jumpPressed) {
        if (f.onGround) { f.vy = JUMP_V * ch.jump; f.onGround = false; f.jumps = 1; SA.Audio.jump(); }
        else if (f.jumps > 0) { f.vy = DJUMP_V * ch.jump; f.jumps--; SA.Audio.jump(); this.addParticles(f.cx, f.y + f.h, f.accent, 6, 4, { grav: 0.05, life: 10 }); }
      }
      // Tap down while standing on a pass-through platform to drop through it.
      if (controllable && f.onGround && intent.dropPressed) f.dropTimer = 8;

      // ---- Gravity / fast-fall ----
      const grav = C.GRAVITY * (f.vy > 0 ? ch.fall : 1);
      f.vy = Math.min(C.MAX_FALL * ch.fall, f.vy + grav);
      if (controllable && !f.shielding && intent.down && f.vy > 0 && !f.onGround) f.vy += FAST_FALL;

      if (f.dropTimer > 0) f.dropTimer--;
      this.collide(f);

      // ---- Attacks ----
      if (f.cooldown > 0) f.cooldown--;
      if (f.specialCD > 0) f.specialCD--;
      if (f.dashTimer > 0) f.dashTimer--;

      if (controllable && !f.shielding && !f.attack && f.cooldown === 0) {
        if (intent.specialPressed && f.specialCD === 0) this.doSpecial(f, foe);
        else if (intent.attackPressed) this.startAttack(f, this.pickAttack(f, intent));
      }
      if (f.attack) this.updateAttack(f, foe);

      // dash special body damage
      if (f.dashTimer > 0 && !f.attack) {
        // dash leaves a trail; collision handled by transient attack set in doSpecial
        this.addParticles(f.cx, f.cy, f.accent, 1, 2, { grav: 0, life: 8 });
      }

      if (f.invuln > 0) f.invuln--;
      if (f.hitstun > 0) f.hitstun--;

      // ---- Ring-out ----
      if (f.cx < DEATH.left || f.cx > DEATH.right || f.y > DEATH.bottom || f.y + f.h < DEATH.top) {
        this.koFighter(f);
      }
    }

    pickAttack(f, intent) {
      const A = SA.ATTACKS;
      if (!f.onGround && intent.down) return A.dair;
      if (intent.up) return A.up;
      if (intent.down) return A.down;
      if (intent.left || intent.right) return A.side;
      return A.jab;
    }

    startAttack(f, def, follow) {
      f.attack = { def, frame: 0, hit: false, follow: !!follow };
      f.cooldown = def.cooldown;
    }

    attackBox(f) {
      const d = f.attack.def;
      const cx = f.cx + (d.ox || 0) * f.facing;
      const cy = f.cy + (d.oy || 0);
      return { x: cx - d.reach / 2, y: cy - d.h / 2, w: d.reach, h: d.h };
    }

    updateAttack(f, foe) {
      const d = f.attack.def;
      f.attack.frame++;
      const fr = f.attack.frame;
      const active = fr > d.startup && fr <= d.startup + d.active;
      if (active && !f.attack.hit && foe.alive() && foe.invuln === 0) {
        if (U.aabb(this.attackBox(f), foe.box())) {
          this.applyHit(f, foe, d);
          f.attack.hit = true;
        }
      }
      if (fr > d.startup + d.active) f.attack = null;
    }

    applyHit(attacker, victim, def) {
      const power = attacker.char.power;
      // Shielded: absorb instead of taking knockback.
      if (victim.shielding && victim.shield > 0) {
        victim.shield = Math.max(0, victim.shield - (def.dmg * power + 6));
        victim.vx += attacker.facing * 2.2;
        SA.Audio.shield();
        this.addParticles(victim.cx, victim.cy, "#bcd6ff", 8, 4, { life: 10 });
        if (victim.shield <= 0) { victim.shieldBroken = C.SHIELD_BREAK_STUN; SA.Audio.shieldBreak(); }
        return;
      }
      victim.damage += def.dmg * power;
      const mag = (def.base + victim.damage * def.scale) * power / victim.char.weight;
      const v = U.launch(def.angle, mag, attacker.facing);
      victim.vx = v.x;
      victim.vy = v.y;
      victim.hitstun = Math.floor(mag * 1.3) + 6;
      victim.invuln = C.HITSTUN_INVULN;
      victim.onGround = false;
      this.shake = Math.min(18, 6 + mag);
      const hx = (attacker.cx + victim.cx) / 2, hy = (attacker.cy + victim.cy) / 2;
      this.addParticles(hx, hy, "#fff3c4", 10 + Math.floor(mag), 5 + mag * 0.2, { life: 12 });
      this.addParticles(hx, hy, def.color || victim.color, 6, 4, { life: 14 });
      if (mag > 11) SA.Audio.launch(); else SA.Audio.hit(mag);
    }

    // ---- Specials ----
    doSpecial(f, foe) {
      const s = f.char.special;
      f.specialCD = s.cooldown;
      SA.Audio.special();
      switch (s.kind) {
        case "projectile": {
          const def = { dmg: s.dmg, base: s.base, scale: s.scale, angle: s.angle, color: s.color, speed: s.speed, radius: s.radius, life: s.life };
          this.projectiles.push(new Projectile(f, def, f.facing));
          this.addParticles(f.cx + f.facing * 28, f.cy, s.color, 6, 4, { life: 8, grav: 0 });
          break;
        }
        case "burst": {
          const def = { dmg: s.dmg, base: s.base, scale: s.scale, angle: s.angle, reach: s.reach, h: s.h, ox: 30, oy: -6, startup: 5, active: 7, cooldown: s.cooldown, color: s.color };
          this.startAttack(f, def);
          this.addParticles(f.cx + f.facing * 30, f.cy, s.color, 14, 6, { life: 16, grav: -0.02 });
          break;
        }
        case "dash": {
          f.vx = f.facing * s.speed;
          f.vy = Math.min(f.vy, -2);
          f.dashTimer = s.dur;
          const def = { dmg: s.dmg, base: s.base, scale: s.scale, angle: s.angle, reach: f.w + 24, h: f.h + 8, ox: 0, oy: 0, startup: 0, active: s.dur, cooldown: s.cooldown, color: s.color };
          this.startAttack(f, def, true);
          break;
        }
        case "quake": {
          if (f.onGround) {
            const def = { dmg: s.dmg, base: s.base, scale: s.scale, angle: s.angle, color: s.color };
            const box = { x: f.cx - s.radius, y: f.cy - 30, w: s.radius * 2, h: 90 };
            if (foe.alive() && foe.invuln === 0 && U.aabb(box, foe.box())) {
              // direction based on which side the foe is on
              const dir = foe.cx >= f.cx ? 1 : -1;
              const saved = f.facing; f.facing = dir;
              this.applyHit(f, foe, def);
              f.facing = saved;
            }
            this.shake = Math.max(this.shake, 12);
            this.addParticles(f.cx, f.cy + 20, s.color, 26, 9, { life: 22, grav: 0.2 });
          } else {
            f.vy = 9; // slam downward if airborne
          }
          break;
        }
        case "rising": {
          f.vy = s.vy;
          f.jumps = Math.max(f.jumps, 1);
          const def = { dmg: s.dmg, base: s.base, scale: s.scale, angle: s.angle, reach: s.reach, h: s.h, ox: 0, oy: -20, startup: 2, active: 8, cooldown: s.cooldown, color: s.color };
          this.startAttack(f, def);
          this.addParticles(f.cx, f.y + f.h, s.color, 12, 5, { life: 16, grav: -0.05 });
          break;
        }
      }
    }

    // ---- Projectiles ----
    stepProjectiles() {
      const pr = this.projectiles;
      for (let i = pr.length - 1; i >= 0; i--) {
        const p = pr[i];
        p.x += p.vx; p.y += p.vy; p.life--;
        this.addParticles(p.x, p.y, p.color, 1, 1.5, { life: 8, grav: 0 });
        // hit the other fighter
        const foe = this.fighters[p.owner.slot === 0 ? 1 : 0];
        if (foe.alive() && foe.invuln === 0) {
          const pb = { x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2 };
          if (U.aabb(pb, foe.box())) {
            const saved = p.owner.facing; p.owner.facing = p.dir;
            this.applyHit(p.owner, foe, p.def);
            p.owner.facing = saved;
            p.dead = true;
          }
        }
        // expire off-screen or by life
        if (p.life <= 0 || p.x < -60 || p.x > C.W + 60) p.dead = true;
        if (p.dead) { this.addParticles(p.x, p.y, p.color, 8, 4, { life: 10, grav: 0 }); pr.splice(i, 1); }
      }
    }

    // ---- Collision with platforms ----
    collide(f) {
      const plats = this.stage.platforms;
      // X axis vs solid platforms
      f.x += f.vx;
      for (const p of plats) {
        if (!p.solid) continue;
        if (U.aabb(f.box(), p)) {
          if (f.vx > 0) f.x = p.x - f.w;
          else if (f.vx < 0) f.x = p.x + p.w;
          f.vx = 0;
        }
      }
      // Y axis
      const prevFoot = f.y + f.h;
      const prevTop = f.y;
      f.y += f.vy;
      f.onGround = false;
      for (const p of plats) {
        const overlapX = f.x + f.w > p.x && f.x < p.x + p.w;
        if (!overlapX) continue;
        const foot = f.y + f.h;
        if (f.vy >= 0 && foot >= p.y && prevFoot <= p.y + 12) {
          if (p.solid || f.dropTimer <= 0) {
            f.y = p.y - f.h;
            f.vy = 0;
            f.onGround = true;
            f.jumps = 2;
          }
        } else if (p.solid && f.vy < 0 && f.y < p.y + p.h && prevTop >= p.y + p.h) {
          f.y = p.y + p.h;
          f.vy = 0;
        }
      }
    }

    // ---- KO ----
    koFighter(f) {
      f.stocks--;
      this.shake = 16;
      this.koFlash = 12;
      SA.Audio.ko();
      this.addParticles(
        U.clamp(f.cx, 30, C.W - 30), U.clamp(f.cy, 30, C.H - 30),
        f.color, 40, 12, { life: 26, grav: 0.1 }
      );
      if (f.stocks <= 0) {
        this.state = "over";
        this.winner = this.fighters[f.slot === 0 ? 1 : 0];
      } else {
        f.respawn = C.RESPAWN_FRAMES;
        f.x = -9999;               // park off-screen during respawn
        f.vx = f.vy = 0;
        f.damage = 0;
        f.hitstun = 0;
      }
    }
  }

  const ZERO_INTENT = {
    left: false, right: false, up: false, down: false,
    attack: false, special: false, shield: false,
    jumpPressed: false, attackPressed: false, specialPressed: false, dropPressed: false,
  };

  SA.Match = Match;
  SA.Fighter = Fighter;
  SA.ZERO_INTENT = ZERO_INTENT;

  // ---- CPU AI -------------------------------------------------------------
  // Returns an intent for `f` against `foe`. Keeps short memory on f._ai for edges.
  SA.aiIntent = function (match, f, foe) {
    const ai = f._ai;
    const it = {
      left: false, right: false, up: false, down: false,
      attack: false, special: false, shield: false,
      jumpPressed: false, attackPressed: false, specialPressed: false, dropPressed: false,
    };
    if (f.respawn > 0 || f.shieldBroken > 0) { syncEdges(ai, it); return it; }

    const main = match.main;
    const mainL = main.x, mainR = main.x + main.w, mainTop = main.y;
    const dx = foe.cx - f.cx;
    const dy = foe.cy - f.cy;
    const dist = Math.abs(dx);
    ai.timer--;

    const offStageX = f.cx < mainL + 10 || f.cx > mainR - 10;
    const belowStage = f.y + f.h > mainTop + 40;

    if (offStageX && belowStage) {
      // Recover: head back toward center, jump/rising as needed.
      if (f.cx < (mainL + mainR) / 2) it.right = true; else it.left = true;
      if (f.vy > 1 && f.jumps > 0) it.jumpPressed = true;
      if (f.vy > 2 && (f.cy > mainTop + 120)) it.specialPressed = true; // up/rising specials help
      syncEdges(ai, it);
      return it;
    }

    // Approach.
    if (dist > 64) { if (dx > 0) it.right = true; else it.left = true; }
    else { f.facing = dx >= 0 ? 1 : -1; }

    // Climb toward an airborne foe.
    if (dy < -60 && Math.abs(dx) < 120 && f.onGround && Math.random() < 0.08) it.jumpPressed = true;

    // Defend: if foe is attacking and close, sometimes shield.
    if (foe.attack && dist < 86 && Math.abs(dy) < 60 && f.onGround && Math.random() < 0.5) {
      it.shield = true;
      syncEdges(ai, it);
      return it;
    }

    // Attack when in range.
    if (dist < 88 && Math.abs(dy) < 80 && ai.timer <= 0 && f.cooldown === 0) {
      if (dy < -34) it.up = true;
      else if (dy > 40 && !f.onGround) it.down = true;
      else if (dist > 40) { it.right = dx > 0; it.left = dx < 0; }
      it.attackPressed = true;
      ai.timer = 10 + Math.floor(Math.random() * 16);
    } else if (f.specialCD === 0 && Math.abs(dy) < 44 && dist > 150 && dist < 520 && Math.random() < 0.03) {
      // Zone with a special (projectile chars mostly) when lined up.
      f.facing = dx >= 0 ? 1 : -1;
      it.specialPressed = true;
    }

    syncEdges(ai, it);
    return it;
  };

  // Convert the AI's per-frame "wants" into rising edges using one-frame memory,
  // so a sustained desire fires a single press instead of repeating every frame.
  function syncEdges(ai, it) {
    const wantJump = it.jumpPressed;
    const wantAttack = it.attackPressed;
    const wantSpecial = it.specialPressed;
    it.jumpPressed = wantJump && !ai.wantJump;
    it.attackPressed = wantAttack && !ai.wantAttack;
    it.specialPressed = wantSpecial && !ai.wantSpecial;
    ai.wantJump = wantJump;
    ai.wantAttack = wantAttack;
    ai.wantSpecial = wantSpecial;
  }
})();
