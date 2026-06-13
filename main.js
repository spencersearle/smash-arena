/* Smash Arena — main.
 * Screen state machine, input → fighter intents, and the RAF loop. */

(() => {
  const SA = window.SA;
  const C = SA.CONFIG;
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  // ---- Input --------------------------------------------------------------
  const keys = new Set();
  const justPressed = new Set();
  const NAV = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Tab", "/", ",", ".", "'"]);

  function norm(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }
  window.addEventListener("keydown", (e) => {
    const k = norm(e);
    if (!keys.has(k)) justPressed.add(k);
    keys.add(k);
    if (NAV.has(e.key) || NAV.has(k)) e.preventDefault();
    SA.Audio.resume();
  });
  window.addEventListener("keyup", (e) => keys.delete(norm(e)));
  window.addEventListener("blur", () => keys.clear());

  const pressed = (k) => justPressed.has(k);
  const anyPressed = (...ks) => ks.some((k) => justPressed.has(k));

  // ---- Game state ---------------------------------------------------------
  const game = {
    state: "menu",
    frame: 0,
    menuIndex: 0,
    menuItems: [],
    sel: [{ index: 0, locked: false, cpu: false }, { index: 1, locked: false, cpu: false }],
    stageIndex: 0,
    stocks: C.DEFAULT_STOCKS,
    pauseIndex: 0,
    match: null,
    charA: null,
    charB: null,
    cpu: false,
  };

  function go(state) { game.state = state; }

  function resetCharSelect() {
    game.sel = [
      { index: 0, locked: false, cpu: false },
      { index: 1 % SA.CHARACTERS.length, locked: false, cpu: false },
    ];
  }

  function startMatch() {
    game.charA = SA.CHARACTERS[game.sel[0].index];
    game.charB = SA.CHARACTERS[game.sel[1].index];
    game.cpu = game.sel[1].cpu;
    game.match = new SA.Match(game.charA, game.charB, SA.STAGES[game.stageIndex], game.stocks);
    go("playing");
  }

  function rematch() {
    game.match = new SA.Match(game.charA, game.charB, SA.STAGES[game.stageIndex], game.stocks);
    go("playing");
  }

  // ---- Build a human player's intent from the keyboard --------------------
  function humanIntent(p) {
    const c = SA.CONTROLS[p];
    return {
      left: keys.has(c.left),
      right: keys.has(c.right),
      up: keys.has(c.up),
      down: keys.has(c.down),
      shield: keys.has(c.shield),
      attack: keys.has(c.attack),
      special: keys.has(c.special),
      jumpPressed: pressed(c.up),
      attackPressed: pressed(c.attack),
      specialPressed: pressed(c.special),
      dropPressed: pressed(c.down),
    };
  }

  // ---- Per-state update ---------------------------------------------------
  function updateMenu() {
    game.menuItems = ["Versus", "How to Play", "Sound: " + (SA.Audio.isEnabled() ? "On" : "Off")];
    if (anyPressed("ArrowUp", "w")) { game.menuIndex = (game.menuIndex + game.menuItems.length - 1) % game.menuItems.length; SA.Audio.menu(); }
    if (anyPressed("ArrowDown", "s")) { game.menuIndex = (game.menuIndex + 1) % game.menuItems.length; SA.Audio.menu(); }
    if (anyPressed("Enter", " ")) {
      SA.Audio.confirm();
      if (game.menuIndex === 0) { resetCharSelect(); go("charselect"); }
      else if (game.menuIndex === 1) go("howto");
      else SA.Audio.setEnabled(!SA.Audio.isEnabled());
    }
  }

  function updateHowto() {
    if (anyPressed("Enter", "Escape", " ")) { SA.Audio.menu(); go("menu"); }
  }

  function updateCharSelect() {
    const n = SA.CHARACTERS.length;
    const s0 = game.sel[0], s1 = game.sel[1];

    // P1 cursor
    if (!s0.locked) {
      if (pressed("a")) { s0.index = (s0.index + n - 1) % n; SA.Audio.menu(); }
      if (pressed("d")) { s0.index = (s0.index + 1) % n; SA.Audio.menu(); }
    }
    if (pressed("f")) { s0.locked = !s0.locked; SA.Audio.confirm(); }

    // toggle P2 = CPU
    if (pressed("Tab")) {
      s1.cpu = !s1.cpu;
      s1.locked = s1.cpu ? true : false;
      SA.Audio.confirm();
    }
    // P2 cursor (human only)
    if (!s1.cpu) {
      if (!s1.locked) {
        if (pressed("ArrowLeft")) { s1.index = (s1.index + n - 1) % n; SA.Audio.menu(); }
        if (pressed("ArrowRight")) { s1.index = (s1.index + 1) % n; SA.Audio.menu(); }
      }
      if (pressed("/")) { s1.locked = !s1.locked; SA.Audio.confirm(); }
    } else {
      // P1 may scroll the CPU's character with Q/E for convenience
      if (pressed("q")) s1.index = (s1.index + n - 1) % n;
      if (pressed("e")) s1.index = (s1.index + 1) % n;
    }

    if (pressed("Escape")) {
      if (s0.locked || s1.locked || s1.cpu) { s0.locked = false; s1.locked = false; s1.cpu = false; SA.Audio.menu(); }
      else go("menu");
    }
    if (anyPressed("Enter") && s0.locked && s1.locked) { SA.Audio.confirm(); go("stageselect"); }
  }

  function updateStageSelect() {
    const n = SA.STAGES.length;
    if (anyPressed("ArrowLeft", "a")) { game.stageIndex = (game.stageIndex + n - 1) % n; SA.Audio.menu(); }
    if (anyPressed("ArrowRight", "d")) { game.stageIndex = (game.stageIndex + 1) % n; SA.Audio.menu(); }
    if (anyPressed("ArrowUp", "w")) { game.stocks = Math.min(5, game.stocks + 1); SA.Audio.menu(); }
    if (anyPressed("ArrowDown", "s")) { game.stocks = Math.max(1, game.stocks - 1); SA.Audio.menu(); }
    if (pressed("Enter")) { SA.Audio.confirm(); startMatch(); }
    if (pressed("Escape")) { SA.Audio.menu(); go("charselect"); }
  }

  function updatePlaying() {
    if (pressed("Escape")) { game.pauseIndex = 0; go("paused"); return; }
    const m = game.match;
    const i0 = humanIntent(0);
    const i1 = game.cpu ? SA.aiIntent(m, m.fighters[1], m.fighters[0]) : humanIntent(1);
    m.update([i0, i1]);
    if (m.state === "over") go("over");
  }

  function updatePaused() {
    if (anyPressed("ArrowUp", "w")) { game.pauseIndex = (game.pauseIndex + 1) % 2; SA.Audio.menu(); }
    if (anyPressed("ArrowDown", "s")) { game.pauseIndex = (game.pauseIndex + 1) % 2; SA.Audio.menu(); }
    if (pressed("Escape")) { SA.Audio.menu(); go("playing"); }
    if (pressed("Enter")) {
      SA.Audio.confirm();
      if (game.pauseIndex === 0) go("playing");
      else { game.match = null; go("menu"); }
    }
  }

  function updateOver() {
    if (pressed("Enter")) { SA.Audio.confirm(); rematch(); }
    if (pressed("Escape")) { SA.Audio.menu(); game.match = null; go("menu"); }
  }

  // ---- Render dispatch ----------------------------------------------------
  function render() {
    const m = game.match;
    const shake = m ? m.shake : 0;
    ctx.save();
    if (shake > 0.3) ctx.translate(Math.sin(game.frame * 7.3) * shake, Math.cos(game.frame * 6.1) * shake);

    switch (game.state) {
      case "menu": SA.UI.menu(ctx, game); break;
      case "howto": SA.UI.howto(ctx); break;
      case "charselect": SA.UI.charSelect(ctx, game); break;
      case "stageselect": SA.UI.stageSelect(ctx, game); break;
      case "playing": SA.UI.world(ctx, m); break;
      case "paused": SA.UI.world(ctx, m); break;
      case "over": SA.UI.gameOver(ctx, m, game); break;
    }
    ctx.restore();
    if (game.state === "paused") SA.UI.pause(ctx, game);
  }

  // ---- Loop ---------------------------------------------------------------
  function loop() {
    game.frame++;
    switch (game.state) {
      case "menu": updateMenu(); break;
      case "howto": updateHowto(); break;
      case "charselect": updateCharSelect(); break;
      case "stageselect": updateStageSelect(); break;
      case "playing": updatePlaying(); break;
      case "paused": updatePaused(); break;
      case "over": updateOver(); break;
    }
    render();
    justPressed.clear();
    requestAnimationFrame(loop);
  }

  loop();
})();
