/* Smash Arena — UI & rendering.
 * Pure draw functions: given the canvas context and game/match state, paint a frame.
 * No game logic lives here. */

(() => {
  const SA = window.SA;
  const C = SA.CONFIG;
  const W = C.W, H = C.H;

  // ---- low-level draw helpers --------------------------------------------
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function text(ctx, str, x, y, font, color, align) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align || "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(str, x, y);
  }
  const F = (w, s) => `${w} ${s}px "Segoe UI", system-ui, sans-serif`;

  function sky(ctx, stage) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    const s = stage ? stage.sky : ["#1a2336", "#141b2b", "#0c111c"];
    g.addColorStop(0, s[0]); g.addColorStop(0.55, s[1]); g.addColorStop(1, s[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const r = ctx.createRadialGradient(W / 2, H * 0.42, 60, W / 2, H * 0.42, 640);
    r.addColorStop(0, stage ? stage.glow : "rgba(78,168,255,0.10)");
    r.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
  }

  // a compact character avatar for menus
  function avatar(ctx, x, y, s, char, facing) {
    facing = facing || 1;
    const w = 46 * s, h = 64 * s;
    ctx.save();
    ctx.translate(x - w / 2, y - h / 2);
    ctx.fillStyle = char.color; roundRect(ctx, 0, 0, w, h, 12 * s); ctx.fill();
    ctx.fillStyle = char.dark; roundRect(ctx, 0, h - 16 * s, w, 16 * s, 12 * s); ctx.fill();
    ctx.fillStyle = char.accent;
    ctx.beginPath(); ctx.arc(w / 2, h * 0.36, 7 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0d1018";
    const ex = facing === 1 ? w - 16 * s : 6 * s;
    ctx.fillRect(ex, 14 * s, 7 * s, 9 * s);
    ctx.fillRect(ex + (facing === 1 ? -10 * s : 10 * s), 14 * s, 7 * s, 9 * s);
    ctx.restore();
  }

  function statBar(ctx, x, y, w, val, color) {
    roundRect(ctx, x, y, w, 6, 3); ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fill();
    roundRect(ctx, x, y, w * SA.util.clamp(val, 0, 1), 6, 3); ctx.fillStyle = color; ctx.fill();
  }

  const UI = {};

  // ---- Main menu ----------------------------------------------------------
  UI.menu = function (ctx, game) {
    sky(ctx, null);
    const t = game.frame;
    text(ctx, "SMASH ARENA", W / 2, 230, F(800, 92), "#e7ecf5");
    text(ctx, "an original platform fighter", W / 2, 274, F(400, 22), "#7e8aa3");

    const items = game.menuItems;
    items.forEach((label, i) => {
      const sel = i === game.menuIndex;
      const y = 360 + i * 64;
      if (sel) {
        roundRect(ctx, W / 2 - 170, y - 34, 340, 50, 12);
        ctx.fillStyle = "rgba(78,168,255,0.16)"; ctx.fill();
        ctx.strokeStyle = "#4ea8ff"; ctx.lineWidth = 2; ctx.stroke();
      }
      text(ctx, label, W / 2, y, F(sel ? 700 : 500, 28), sel ? "#bfe2ff" : "#9aa6bd");
    });
    const pulse = 0.5 + 0.5 * Math.sin(t / 20);
    ctx.globalAlpha = 0.6 + pulse * 0.4;
    text(ctx, "↑ ↓ to choose · ENTER to select", W / 2, H - 60, F(400, 18), "#6f7c93");
    ctx.globalAlpha = 1;
  };

  // ---- How to play --------------------------------------------------------
  UI.howto = function (ctx) {
    sky(ctx, null);
    text(ctx, "HOW TO PLAY", W / 2, 130, F(800, 52), "#e7ecf5");
    const rows = [
      ["", "Player 1", "Player 2"],
      ["Move", "A / D", "← / →"],
      ["Jump (double)", "W", "↑"],
      ["Drop / Fast-fall", "S", "↓"],
      ["Attack (+ a direction)", "F", "/"],
      ["Special", "G", "."],
      ["Shield (hold)", "E", ","],
    ];
    const x0 = W / 2 - 360, cw = 360;
    rows.forEach((r, i) => {
      const y = 210 + i * 52;
      const head = i === 0;
      if (i > 0 && i % 2 === 1) { roundRect(ctx, x0 - 20, y - 30, cw * 2 + 40, 44, 8); ctx.fillStyle = "rgba(255,255,255,0.04)"; ctx.fill(); }
      text(ctx, r[0], x0, y, F(head ? 700 : 500, 22), head ? "#7e8aa3" : "#cdd7e8", "left");
      text(ctx, r[1], x0 + cw, y, F(700, 22), head ? "#4ea8ff" : "#bfe2ff", "center");
      text(ctx, r[2], x0 + cw * 1.7, y, F(700, 22), head ? "#ff6b5e" : "#ffd0c8", "center");
    });
    text(ctx, "Land hits to raise your rival's damage %. The higher it climbs, the farther", W / 2, H - 130, F(400, 19), "#9aa6bd");
    text(ctx, "they fly — knock them past the edge to take a stock. Last fighter standing wins.", W / 2, H - 104, F(400, 19), "#9aa6bd");
    text(ctx, "ESC / ENTER to go back", W / 2, H - 50, F(400, 18), "#6f7c93");
  };

  // ---- Character select ---------------------------------------------------
  UI.charSelect = function (ctx, game) {
    sky(ctx, null);
    text(ctx, "CHOOSE YOUR FIGHTER", W / 2, 80, F(800, 44), "#e7ecf5");

    const chars = SA.CHARACTERS;
    const n = chars.length;
    const cw = 176, ch = 232, gap = 16;
    const totalW = n * cw + (n - 1) * gap;
    const x0 = (W - totalW) / 2;
    const y0 = 130;

    for (let i = 0; i < n; i++) {
      const cx = x0 + i * (cw + gap);
      const char = chars[i];
      // card
      roundRect(ctx, cx, y0, cw, ch, 14);
      ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1; ctx.stroke();
      // glow strip in character color
      roundRect(ctx, cx, y0, cw, 6, 6); ctx.fillStyle = char.color; ctx.fill();

      avatar(ctx, cx + cw / 2, y0 + 78, 1.25, char, 1);
      text(ctx, char.name, cx + cw / 2, y0 + 150, F(800, 22), char.color);
      // stat bars
      const bx = cx + 22, bw = cw - 44;
      text(ctx, "PWR", bx, y0 + 176, F(600, 11), "#7e8aa3", "left");
      statBar(ctx, bx + 34, y0 + 169, bw - 34, (char.power - 0.8) / 0.5, "#ff9a6b");
      text(ctx, "SPD", bx, y0 + 196, F(600, 11), "#7e8aa3", "left");
      statBar(ctx, bx + 34, y0 + 189, bw - 34, (char.speed - 0.7) / 0.6, "#67e08a");
      text(ctx, "WGT", bx, y0 + 216, F(600, 11), "#7e8aa3", "left");
      statBar(ctx, bx + 34, y0 + 209, bw - 34, (char.weight - 0.78) / 0.6, "#4ea8ff");
    }

    // cursors
    const drawCursor = (sel, color, label, locked, cpu, yoff) => {
      const cx = x0 + sel * (cw + gap);
      ctx.strokeStyle = color; ctx.lineWidth = locked ? 5 : 3;
      ctx.setLineDash(locked ? [] : [10, 8]);
      ctx.lineDashOffset = locked ? 0 : -game.frame * 0.6;
      roundRect(ctx, cx - 4, y0 - 4, cw + 8, ch + 8, 16); ctx.stroke();
      ctx.setLineDash([]);
      // tag
      roundRect(ctx, cx + cw / 2 - 52, y0 + ch + 8 + yoff, 104, 30, 8);
      ctx.fillStyle = color; ctx.fill();
      text(ctx, label + (locked ? " ✓" : ""), cx + cw / 2, y0 + ch + 29 + yoff, F(800, 15), "#0d1018");
    };
    drawCursor(game.sel[0].index, "#4ea8ff", "P1", game.sel[0].locked, false, 0);
    drawCursor(game.sel[1].index, "#ff6b5e", game.sel[1].cpu ? "CPU" : "P2", game.sel[1].locked, game.sel[1].cpu, 36);

    // blurb of P1's hovered character
    const blurb = chars[game.sel[0].index].blurb;
    text(ctx, blurb, W / 2, H - 96, F(400, 18), "#9aa6bd");

    const bothLocked = game.sel[0].locked && game.sel[1].locked;
    if (bothLocked) {
      const pulse = 0.5 + 0.5 * Math.sin(game.frame / 16);
      ctx.globalAlpha = 0.55 + pulse * 0.45;
      text(ctx, "ENTER to pick a stage", W / 2, H - 52, F(700, 22), "#bfe2ff");
      ctx.globalAlpha = 1;
    } else {
      text(ctx, "P1: A/D move · F lock    P2: ←/→ move · / lock    [TAB] toggle P2 CPU    [ESC] back", W / 2, H - 52, F(400, 16), "#6f7c93");
    }
  };

  // ---- Stage select -------------------------------------------------------
  UI.stageSelect = function (ctx, game) {
    sky(ctx, SA.STAGES[game.stageIndex]);
    text(ctx, "SELECT STAGE", W / 2, 90, F(800, 46), "#e7ecf5");

    const stages = SA.STAGES;
    const n = stages.length;
    const cw = 320, chh = 200, gap = 30;
    const totalW = n * cw + (n - 1) * gap;
    const x0 = (W - totalW) / 2, y0 = 180;

    for (let i = 0; i < n; i++) {
      const sx = x0 + i * (cw + gap);
      const st = stages[i];
      const sel = i === game.stageIndex;
      roundRect(ctx, sx, y0, cw, chh, 14);
      const g = ctx.createLinearGradient(0, y0, 0, y0 + chh);
      g.addColorStop(0, st.sky[0]); g.addColorStop(1, st.sky[2]);
      ctx.fillStyle = g; ctx.fill();
      // mini platforms preview
      const sc = cw / W;
      ctx.save();
      ctx.translate(sx, y0 + 20);
      for (const p of st.platforms) {
        ctx.fillStyle = p.solid ? "#3a4a6b" : "#32415e";
        const px = p.x * sc, py = p.y * sc * 0.7, pw = p.w * sc, ph = Math.max(4, p.h * sc * 0.7);
        roundRect(ctx, px, py, pw, ph, 3); ctx.fill();
      }
      ctx.restore();
      text(ctx, st.name, sx + cw / 2, y0 + chh - 18, F(800, 22), "#e7ecf5");
      if (sel) {
        ctx.strokeStyle = "#4ea8ff"; ctx.lineWidth = 4;
        roundRect(ctx, sx - 4, y0 - 4, cw + 8, chh + 8, 16); ctx.stroke();
      } else {
        ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1;
        roundRect(ctx, sx, y0, cw, chh, 14); ctx.stroke();
      }
    }

    // stock selector
    roundRect(ctx, W / 2 - 130, y0 + chh + 50, 260, 56, 12);
    ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fill();
    text(ctx, "STOCKS", W / 2 - 70, y0 + chh + 84, F(700, 18), "#9aa6bd", "center");
    text(ctx, "◄  " + game.stocks + "  ►", W / 2 + 50, y0 + chh + 85, F(800, 26), "#bfe2ff", "center");

    text(ctx, "←/→ stage · ↑/↓ stocks · ENTER fight · ESC back", W / 2, H - 48, F(400, 17), "#6f7c93");
  };

  // ---- In-match world -----------------------------------------------------
  UI.world = function (ctx, match) {
    sky(ctx, match.stage);
    for (const p of match.stage.platforms) {
      roundRect(ctx, p.x, p.y, p.w, p.h, 10);
      ctx.fillStyle = p.solid ? "#2c3954" : "#26324a"; ctx.fill();
      roundRect(ctx, p.x, p.y, p.w, 5, 10); ctx.fillStyle = "rgba(120,160,220,0.45)"; ctx.fill();
    }
    // particles (under fighters)
    for (const pt of match.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // projectiles
    for (const pr of match.projectiles) {
      ctx.fillStyle = pr.color;
      ctx.shadowColor = pr.color; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    // fighters
    for (const f of match.fighters) drawFighter(ctx, f, match);
    // HUD
    drawHUD(ctx, match);

    if (match.koFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${match.koFlash / 12 * 0.4})`;
      ctx.fillRect(0, 0, W, H);
    }
  };

  function drawFighter(ctx, f, match) {
    if (f.respawn > 0) return;
    const blink = (f.invuln > 0 && Math.floor(match.frame / 4) % 2 === 0);
    ctx.save();
    ctx.globalAlpha = blink ? 0.45 : 1;

    // high-damage aura
    if (f.damage > 80) {
      const a = SA.util.clamp((f.damage - 80) / 120, 0, 0.5);
      ctx.shadowColor = "#ff5a4a"; ctx.shadowBlur = 18 * a + 6;
    }
    // body
    ctx.fillStyle = f.color; roundRect(ctx, f.x, f.y, f.w, f.h, 12); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = f.dark; roundRect(ctx, f.x, f.y + f.h - 16, f.w, 16, 12); ctx.fill();
    // emblem
    ctx.fillStyle = f.accent;
    ctx.beginPath(); ctx.arc(f.cx, f.y + f.h * 0.36, 7, 0, Math.PI * 2); ctx.fill();
    // eyes
    ctx.fillStyle = "#0d1018";
    const ex = f.facing === 1 ? f.x + f.w - 18 : f.x + 11;
    ctx.fillRect(ex, f.y + 15, 8, 10);
    ctx.fillRect(ex + (f.facing === 1 ? -12 : 12), f.y + 15, 8, 10);

    // attack swing
    if (f.attack) {
      const d = f.attack.def;
      const fr = f.attack.frame;
      const active = fr > d.startup && fr <= d.startup + d.active;
      const b = match.attackBox(f);
      ctx.fillStyle = active ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.16)";
      if (active && d.color) ctx.fillStyle = hexA(d.color, 0.8);
      roundRect(ctx, b.x, b.y, b.w, b.h, 10); ctx.fill();
    }
    ctx.restore();

    // shield bubble
    if (f.shielding) {
      const r = 40 * (0.4 + 0.6 * (f.shield / C.SHIELD_MAX));
      ctx.fillStyle = "rgba(120,180,255,0.22)";
      ctx.strokeStyle = "rgba(150,200,255,0.6)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(f.cx, f.cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    if (f.shieldBroken > 0) {
      ctx.fillStyle = "#fff";
      text(ctx, "★", f.cx, f.y - 6, F(700, 20), "#ffe27a");
    }
  }

  function drawHUD(ctx, match) {
    const slots = [{ f: match.fighters[0], x: W * 0.30 }, { f: match.fighters[1], x: W * 0.70 }];
    for (const s of slots) {
      const f = s.f;
      // stocks (top row)
      for (let i = 0; i < f.stocks; i++) {
        ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.arc(s.x - (f.stocks - 1) * 11 + i * 22, H - 118, 6, 0, Math.PI * 2); ctx.fill();
      }
      text(ctx, f.name, s.x, H - 90, F(700, 19), f.color);
      const pct = Math.round(f.damage);
      const heat = SA.util.clamp(f.damage / 150, 0, 1);
      const col = `rgb(238,${Math.round(238 - heat * 190)},${Math.round(238 - heat * 210)})`;
      text(ctx, pct + "%", s.x, H - 40, F(800, 52), col);
      // shield sliver
      const sw = 80;
      roundRect(ctx, s.x - sw / 2, H - 16, sw, 5, 3); ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fill();
      roundRect(ctx, s.x - sw / 2, H - 16, sw * (f.shield / C.SHIELD_MAX), 5, 3);
      ctx.fillStyle = f.shieldBroken > 0 ? "#ff6b5e" : "#7fb3ff"; ctx.fill();
    }
  }

  UI.pause = function (ctx, game) {
    ctx.fillStyle = "rgba(8,11,18,0.72)"; ctx.fillRect(0, 0, W, H);
    text(ctx, "PAUSED", W / 2, 250, F(800, 64), "#e7ecf5");
    const items = ["Resume", "Quit to Menu"];
    items.forEach((label, i) => {
      const sel = i === game.pauseIndex;
      const y = 360 + i * 64;
      if (sel) { roundRect(ctx, W / 2 - 160, y - 34, 320, 50, 12); ctx.fillStyle = "rgba(78,168,255,0.16)"; ctx.fill(); ctx.strokeStyle = "#4ea8ff"; ctx.lineWidth = 2; ctx.stroke(); }
      text(ctx, label, W / 2, y, F(sel ? 700 : 500, 26), sel ? "#bfe2ff" : "#9aa6bd");
    });
    text(ctx, "↑↓ choose · ENTER select · ESC resume", W / 2, H - 60, F(400, 18), "#6f7c93");
  };

  UI.gameOver = function (ctx, match, game) {
    UI.world(ctx, match);
    ctx.fillStyle = "rgba(8,11,18,0.78)"; ctx.fillRect(0, 0, W, H);
    const win = match.winner;
    text(ctx, (win ? win.name : "—") + " WINS", W / 2, H / 2 - 30, F(800, 76), win ? win.color : "#fff");
    if (win) avatar(ctx, W / 2, H / 2 - 150, 2.0, win.char, 1);
    text(ctx, "ENTER — rematch      ESC — menu", W / 2, H / 2 + 50, F(500, 24), "#9aa6bd");
  };

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  SA.UI = UI;
})();
