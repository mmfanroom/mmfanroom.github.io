(function () {
  "use strict";

  var root = document.querySelector("[data-game-root]");
  var Core = window.StageRushCore;
  if (!root || !Core) {
    return;
  }

  var canvas = document.getElementById("game-canvas");
  var ctx = canvas.getContext("2d", { alpha: false });
  var ui = {
    level: document.getElementById("game-level"),
    score: document.getElementById("game-score"),
    time: document.getElementById("game-time"),
    lives: document.getElementById("game-lives"),
    notes: document.getElementById("game-notes"),
    best: document.getElementById("game-best"),
    progress: document.getElementById("game-progress"),
    overlay: document.getElementById("game-overlay"),
    overlayTag: document.getElementById("game-overlay-tag"),
    overlayTitle: document.getElementById("game-overlay-title"),
    overlayCopy: document.getElementById("game-overlay-copy"),
    primary: document.getElementById("game-primary-action"),
    primaryLabel: document.querySelector("#game-primary-action span"),
    pause: document.getElementById("game-pause"),
    restart: document.getElementById("game-restart"),
    sound: document.getElementById("game-sound"),
    soundOff: document.querySelector("#game-sound .sound-off"),
    soundOn: document.querySelector("#game-sound .sound-on"),
    announcer: document.getElementById("game-announcer"),
    levelButtons: Array.prototype.slice.call(document.querySelectorAll("[data-level]")),
    outfitButtons: Array.prototype.slice.call(document.querySelectorAll("[data-outfit]")),
    moveButtons: Array.prototype.slice.call(document.querySelectorAll("[data-move]"))
  };

  var STORAGE = {
    unlocked: "stageRush.unlocked",
    best: "stageRush.best",
    outfit: "stageRush.outfit"
  };
  var OUTFITS = {
    cyan: { jacket: "#38bdf8", accent: "#ec4899", shade: "#1d4ed8" },
    pink: { jacket: "#ec4899", accent: "#a855f7", shade: "#9d174d" },
    gold: { jacket: "#fbbf24", accent: "#38bdf8", shade: "#b45309" }
  };

  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var unlocked = Core.clamp(readNumber(STORAGE.unlocked, 1), 1, Core.LEVELS.length);
  var bestScore = Math.max(0, readNumber(STORAGE.best, 0));
  var outfit = readString(STORAGE.outfit, "cyan");
  if (!OUTFITS[outfit]) {
    outfit = "cyan";
  }

  var state = Core.createGame(0);
  var actionMode = "start";
  var soundEnabled = false;
  var audioContext = null;
  var lastFrame = performance.now();
  var pointerStart = null;
  var flash = 0;

  ctx.imageSmoothingEnabled = false;

  function readNumber(key, fallback) {
    try {
      var value = Number(window.localStorage.getItem(key));
      return Number.isFinite(value) && value >= 0 ? value : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function readString(key, fallback) {
    try {
      return window.localStorage.getItem(key) || fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveValue(key, value) {
    try {
      window.localStorage.setItem(key, String(value));
    } catch (error) {
      // Storage is optional; the game remains fully playable without it.
    }
  }

  function setText(element, value) {
    var text = String(value);
    if (element && element.textContent !== text) {
      element.textContent = text;
    }
  }

  function announce(message) {
    setText(ui.announcer, message);
  }

  function formatScore(score) {
    return String(Math.max(0, Math.round(score))).padStart(4, "0");
  }

  function updateHud() {
    var collected = state.collectibles.filter(function (item) { return item.collected; }).length;
    var energy = Array.from({ length: 3 }, function (_, index) {
      return index < state.lives ? "♥" : "·";
    }).join(" ");

    setText(ui.level, (state.levelIndex + 1) + " / " + Core.LEVELS.length);
    setText(ui.score, formatScore(state.score));
    setText(ui.time, Math.ceil(state.timeRemaining));
    setText(ui.lives, energy);
    setText(ui.notes, collected + " / " + state.collectibles.length);
    setText(ui.best, formatScore(bestScore));
    ui.lives.setAttribute("aria-label", state.lives + " energy remaining");
    root.dataset.gameStatus = state.status;
    root.dataset.gameLevel = String(state.levelIndex + 1);
    root.dataset.playerRow = String(state.player.row);
    root.dataset.lives = String(state.lives);
  }

  function updateLevelMenu() {
    setText(ui.progress, unlocked + " / " + Core.LEVELS.length + " unlocked");
    ui.levelButtons.forEach(function (button, index) {
      var available = index < unlocked;
      var active = index === state.levelIndex;
      var label = button.querySelector(".level-state");
      button.disabled = !available;
      button.classList.toggle("active", active);
      setText(label, active ? "Selected" : (available ? "Open" : "Locked"));
    });
  }

  function showOverlay(mode) {
    actionMode = mode;
    ui.overlay.hidden = false;
    var levelNumber = "Level " + (state.levelIndex + 1);

    if (mode === "start") {
      setText(ui.overlayTag, levelNumber);
      setText(ui.overlayTitle, state.level.name);
      setText(ui.overlayCopy, state.level.goal + ".");
      setText(ui.primaryLabel, "Start level");
    } else if (mode === "resume") {
      setText(ui.overlayTag, levelNumber);
      setText(ui.overlayTitle, "Paused");
      setText(ui.overlayCopy, "The stage is holding.");
      setText(ui.primaryLabel, "Resume");
    } else if (mode === "retry") {
      setText(ui.overlayTag, "Run over");
      setText(ui.overlayTitle, state.timeRemaining <= 0 ? "Time's up" : "Out of energy");
      setText(ui.overlayCopy, "Score " + formatScore(state.score) + ". Ready for another run?");
      setText(ui.primaryLabel, "Try again");
    } else if (mode === "next") {
      setText(ui.overlayTag, "Level clear");
      setText(ui.overlayTitle, state.level.name + " complete");
      setText(ui.overlayCopy, "Score " + formatScore(state.score) + ". The next stage is open.");
      setText(ui.primaryLabel, "Next level");
    } else if (mode === "victory") {
      setText(ui.overlayTag, "Tour complete");
      setText(ui.overlayTitle, "Finale complete");
      setText(ui.overlayCopy, "Final score " + formatScore(state.score) + ". You reached the mic!");
      setText(ui.primaryLabel, "Play again");
    }
  }

  function hideOverlay() {
    ui.overlay.hidden = true;
  }

  function updateBestScore() {
    if (state.score > bestScore) {
      bestScore = Math.round(state.score);
      saveValue(STORAGE.best, bestScore);
    }
  }

  function loadLevel(index, carriedScore) {
    state = Core.createGame(index, carriedScore || 0);
    flash = 0;
    updateLevelMenu();
    updateHud();
    showOverlay("start");
    render();
  }

  function beginLevel() {
    Core.startGame(state);
    hideOverlay();
    announce(state.level.name + " started. " + state.level.goal + ".");
    playTone(440, 0.08, "square");
    canvas.focus({ preventScroll: true });
    lastFrame = performance.now();
  }

  function handlePrimaryAction() {
    if (actionMode === "start") {
      beginLevel();
    } else if (actionMode === "resume") {
      Core.togglePause(state);
      updateHud();
      hideOverlay();
      announce("Game resumed.");
      canvas.focus({ preventScroll: true });
    } else if (actionMode === "retry") {
      loadLevel(state.levelIndex, state.levelStartScore);
      beginLevel();
    } else if (actionMode === "next") {
      state = Core.nextLevel(state);
      updateLevelMenu();
      updateHud();
      showOverlay("start");
      render();
    } else if (actionMode === "victory") {
      loadLevel(0, 0);
    }
  }

  function onStateChange(previousStatus, previousLives) {
    if (state.lives < previousLives) {
      flash = reducedMotion ? 0 : 0.24;
      playTone(120, 0.16, "sawtooth");
      announce("Hit. " + state.lives + " energy remaining.");
    }

    if (state.status === previousStatus) {
      return;
    }

    if (state.status === "gameOver") {
      updateBestScore();
      updateHud();
      showOverlay("retry");
      announce("Run over. Score " + state.score + ".");
    } else if (state.status === "levelComplete") {
      unlocked = Math.max(unlocked, Math.min(Core.LEVELS.length, state.levelIndex + 2));
      saveValue(STORAGE.unlocked, unlocked);
      updateBestScore();
      updateLevelMenu();
      updateHud();
      playSuccess();
      if (state.levelIndex === Core.LEVELS.length - 1) {
        showOverlay("victory");
        announce("Festival Finale complete. Final score " + state.score + ".");
      } else {
        showOverlay("next");
        announce(state.level.name + " complete. Next level unlocked.");
      }
    }
  }

  function move(direction) {
    if (state.status !== "running") {
      return;
    }

    var vectors = {
      up: [0, -1],
      down: [0, 1],
      left: [-1, 0],
      right: [1, 0]
    };
    var vector = vectors[direction];
    if (!vector) {
      return;
    }

    var previousStatus = state.status;
    var previousLives = state.lives;
    var previousCollected = state.collectibles.filter(function (item) { return item.collected; }).length;
    Core.movePlayer(state, vector[0], vector[1]);
    var collected = state.collectibles.filter(function (item) { return item.collected; }).length;

    playTone(collected > previousCollected ? 760 : 260, collected > previousCollected ? 0.1 : 0.035, "square");
    onStateChange(previousStatus, previousLives);
    updateHud();
    render();
  }

  function togglePause() {
    if (state.status === "running") {
      Core.togglePause(state);
      updateHud();
      showOverlay("resume");
      announce("Game paused.");
    } else if (state.status === "paused") {
      Core.togglePause(state);
      updateHud();
      hideOverlay();
      announce("Game resumed.");
      canvas.focus({ preventScroll: true });
    }
  }

  function ensureAudio() {
    if (!audioContext) {
      var AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioContext = new AudioContext();
      }
    }
    if (audioContext && audioContext.state === "suspended") {
      audioContext.resume();
    }
  }

  function playTone(frequency, duration, wave) {
    if (!soundEnabled) {
      return;
    }
    ensureAudio();
    if (!audioContext) {
      return;
    }
    var oscillator = audioContext.createOscillator();
    var gain = audioContext.createGain();
    oscillator.type = wave || "square";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.045, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  }

  function playSuccess() {
    if (!soundEnabled) {
      return;
    }
    [523, 659, 784].forEach(function (frequency, index) {
      window.setTimeout(function () { playTone(frequency, 0.14, "square"); }, index * 90);
    });
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    if (soundEnabled) {
      ensureAudio();
      playTone(520, 0.08, "square");
    }
    ui.sound.setAttribute("aria-pressed", soundEnabled ? "true" : "false");
    ui.sound.setAttribute("aria-label", soundEnabled ? "Turn sound off" : "Turn sound on");
    ui.sound.title = soundEnabled ? "Turn sound off" : "Turn sound on";
    ui.soundOff.hidden = soundEnabled;
    ui.soundOn.hidden = !soundEnabled;
  }

  function fillRect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  }

  function drawBackground() {
    var palette = state.level.palette;
    fillRect(0, 0, Core.BOARD.width, Core.BOARD.height, palette[0]);

    for (var row = 0; row < Core.BOARD.rows; row += 1) {
      var y = row * Core.BOARD.cellHeight;
      var safe = state.level.safeRows.indexOf(row) !== -1;
      var laneColor = safe ? "rgba(56, 189, 248, 0.055)" : (row % 2 ? "rgba(255,255,255,0.035)" : "rgba(139,92,246,0.055)");
      fillRect(0, y, Core.BOARD.width, Core.BOARD.cellHeight, laneColor);
      fillRect(0, y, Core.BOARD.width, 2, safe ? "rgba(56,189,248,.24)" : "rgba(255,255,255,.045)");

      if (safe && row !== 0) {
        for (var marker = 0; marker < Core.BOARD.width; marker += 32) {
          fillRect(marker, y + 28, 15, 3, "rgba(56,189,248,.16)");
        }
      }
    }

    fillRect(0, 0, Core.BOARD.width, Core.BOARD.cellHeight, palette[1]);
    for (var light = 0; light < 10; light += 1) {
      var pulse = reducedMotion ? 0 : Math.round(Math.sin(state.elapsed * 3 + light) * 2);
      fillRect(12 + light * 49, 5 + pulse, 8, 8, light % 2 ? "#ec4899" : palette[2]);
    }

    if (state.levelIndex > 0) {
      fillRect(8, 60, 5, 480, "#293046");
      fillRect(467, 60, 5, 480, "#293046");
      for (var brace = 76; brace < 540; brace += 38) {
        fillRect(8, brace, 13, 3, "#586174");
        fillRect(459, brace, 13, 3, "#586174");
      }
    }
  }

  function drawGoal() {
    var x = Core.BOARD.width / 2;
    fillRect(x - 54, 46, 108, 7, "#211a3e");
    fillRect(x - 42, 52, 84, 4, state.level.palette[2]);
    fillRect(x - 2, 18, 4, 31, "#d6d3e5");
    fillRect(x - 10, 14, 18, 10, "#151325");
    fillRect(x - 7, 16, 12, 6, "#ec4899");
    fillRect(x - 12, 48, 24, 4, "#d6d3e5");
  }

  function drawPixelStar(x, y, color) {
    fillRect(x + 8, y, 6, 22, color);
    fillRect(x, y + 8, 22, 6, color);
    fillRect(x + 3, y + 3, 16, 16, color);
    fillRect(x + 7, y + 7, 8, 8, "#fff4bb");
  }

  function drawCollectible(item) {
    if (item.collected) {
      return;
    }
    var x = item.col * Core.BOARD.cellWidth + 13;
    var y = item.row * Core.BOARD.cellHeight + 18;
    var bob = reducedMotion ? 0 : Math.round(Math.sin(state.elapsed * 5 + item.col) * 2);
    if (item.type === "star") {
      drawPixelStar(x, y + bob, "#fbbf24");
    } else {
      fillRect(x + 6, y + bob, 5, 22, "#38bdf8");
      fillRect(x + 11, y + bob, 13, 5, "#38bdf8");
      fillRect(x, y + 17 + bob, 11, 8, "#ec4899");
      fillRect(x + 16, y + 10 + bob, 10, 8, "#ec4899");
    }
  }

  function drawHazard(hazard) {
    var x = Math.round(hazard.x);
    var y = Math.round(hazard.y);
    var w = hazard.width;
    var h = hazard.height;

    if (hazard.type === "case") {
      fillRect(x, y + 5, w, h - 9, "#30384b");
      fillRect(x + 4, y + 9, w - 8, h - 17, "#48546a");
      fillRect(x + 9, y, 24, 6, "#94a3b8");
      fillRect(x + 7, y + h - 5, 9, 5, "#0b0d14");
      fillRect(x + w - 16, y + h - 5, 9, 5, "#0b0d14");
      fillRect(x + w - 11, y + 12, 5, 8, "#fbbf24");
    } else if (hazard.type === "cable") {
      fillRect(x + 8, y + 6, w - 16, 5, "#ec4899");
      fillRect(x + 19, y + 2, 18, 5, "#ec4899");
      fillRect(x, y + 3, 12, 11, "#17182a");
      fillRect(x + w - 12, y + 3, 12, 11, "#17182a");
      fillRect(x + 3, y + 6, 4, 5, "#38bdf8");
      fillRect(x + w - 7, y + 6, 4, 5, "#38bdf8");
    } else if (hazard.type === "crew") {
      fillRect(x + 11, y, 12, 12, "#eabf9f");
      fillRect(x + 8, y + 12, 18, 21, "#fbbf24");
      fillRect(x + 4, y + 16, 5, 20, "#fbbf24");
      fillRect(x + 26, y + 16, 5, 20, "#fbbf24");
      fillRect(x + 9, y + 33, 7, 15, "#334155");
      fillRect(x + 20, y + 33, 7, 15, "#334155");
      fillRect(x + 8, y + 22, 19, 4, "#fb7185");
    } else if (hazard.type === "spotlight") {
      ctx.globalAlpha = 0.22;
      fillRect(x + 5, y + 4, w - 10, h - 8, state.level.palette[2]);
      ctx.globalAlpha = 1;
      fillRect(x + 16, y + 16, 22, 22, "#e2e8f0");
      fillRect(x + 20, y + 20, 14, 14, "#fef3c7");
      fillRect(x + 10, y + 39, 34, 5, "#475569");
    } else if (hazard.type === "speaker") {
      fillRect(x, y, w, h, "#161827");
      fillRect(x + 4, y + 4, w - 8, h - 8, "#282b3c");
      fillRect(x + 16, y + 8, 20, 20, "#090a12");
      fillRect(x + 20, y + 12, 12, 12, "#64748b");
      fillRect(x + 19, y + 32, 14, 8, "#090a12");
      fillRect(x + 3, y + 3, 5, 5, "#38bdf8");
    } else if (hazard.type === "confetti") {
      var confettiColors = ["#ec4899", "#38bdf8", "#fbbf24", "#a855f7"];
      for (var piece = 0; piece < 9; piece += 1) {
        fillRect(x + (piece * 17) % w, y + (piece * 11) % h, 7, 5, confettiColors[piece % confettiColors.length]);
      }
    } else if (hazard.type === "barrier") {
      fillRect(x, y + 5, w, 6, "#cbd5e1");
      fillRect(x + 8, y + 10, 5, h - 10, "#64748b");
      fillRect(x + w - 13, y + 10, 5, h - 10, "#64748b");
      fillRect(x, y + h - 7, 22, 7, "#ec4899");
      fillRect(x + w - 22, y + h - 7, 22, 7, "#38bdf8");
    } else if (hazard.type === "throwable") {
      drawPixelStar(x + 8, y + 8, "#ec4899");
      fillRect(x + 2, y + 15, 5, 8, "#f8fafc");
      fillRect(x + w - 7, y + 15, 5, 8, "#f8fafc");
    }
  }

  function drawPlayer() {
    if (state.invulnerable > 0 && Math.floor(state.elapsed * 14) % 2 === 0) {
      return;
    }

    var colors = OUTFITS[outfit];
    var baseX = state.player.col * Core.BOARD.cellWidth + 10;
    var baseY = state.player.row * Core.BOARD.cellHeight + 7;
    var step = state.status === "running" && !reducedMotion ? Math.floor(state.elapsed * 8) % 2 : 0;
    var bob = step ? 1 : 0;

    ctx.globalAlpha = 0.28;
    fillRect(baseX + 5, baseY + 43, 24, 5, "#000000");
    ctx.globalAlpha = 1;

    fillRect(baseX + 8, baseY + bob, 20, 6, "#19111f");
    fillRect(baseX + 6, baseY + 5 + bob, 24, 8, "#2b1726");
    fillRect(baseX + 10, baseY + 11 + bob, 16, 10, "#e9b899");
    fillRect(baseX + 13, baseY + 14 + bob, 3, 3, "#25151f");
    fillRect(baseX + 22, baseY + 14 + bob, 3, 3, "#25151f");
    fillRect(baseX + 8, baseY + 21 + bob, 21, 15, colors.jacket);
    fillRect(baseX + 13, baseY + 21 + bob, 6, 15, colors.accent);
    fillRect(baseX + 3, baseY + 23 + bob, 5, 14, colors.shade);
    fillRect(baseX + 29, baseY + 23 + bob, 5, 14, colors.shade);
    fillRect(baseX + 9, baseY + 36 + bob, 8, 10 - step, "#171827");
    fillRect(baseX + 21, baseY + 36 + bob, 8, 9 + step, "#171827");
    fillRect(baseX + 7, baseY + 44, 11, 4, "#f8fafc");
    fillRect(baseX + 21, baseY + 44, 11, 4, "#f8fafc");
  }

  function render() {
    drawBackground();
    drawGoal();
    state.hazards.forEach(drawHazard);
    state.collectibles.forEach(drawCollectible);
    drawPlayer();

    if (flash > 0) {
      ctx.globalAlpha = Math.min(0.45, flash * 1.6);
      fillRect(0, 0, Core.BOARD.width, Core.BOARD.height, "#ec4899");
      ctx.globalAlpha = 1;
    }
  }

  function frame(now) {
    var delta = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    var previousStatus = state.status;
    var previousLives = state.lives;

    if (state.status === "running") {
      Core.update(state, delta);
      flash = Math.max(0, flash - delta);
      onStateChange(previousStatus, previousLives);
      updateHud();
    }
    render();
    window.requestAnimationFrame(frame);
  }

  function keyDirection(key) {
    var keys = {
      ArrowUp: "up",
      w: "up",
      W: "up",
      ArrowDown: "down",
      s: "down",
      S: "down",
      ArrowLeft: "left",
      a: "left",
      A: "left",
      ArrowRight: "right",
      d: "right",
      D: "right"
    };
    return keys[key];
  }

  ui.primary.addEventListener("click", handlePrimaryAction);
  ui.pause.addEventListener("click", togglePause);
  ui.restart.addEventListener("click", function () {
    loadLevel(state.levelIndex, state.levelStartScore);
    announce("Level restarted.");
  });
  ui.sound.addEventListener("click", toggleSound);

  ui.moveButtons.forEach(function (button) {
    button.addEventListener("click", function () { move(button.dataset.move); });
  });

  ui.levelButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      var index = Number(button.dataset.level);
      if (index < unlocked) {
        loadLevel(index, 0);
        announce(Core.LEVELS[index].name + " selected.");
      }
    });
  });

  ui.outfitButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      outfit = button.dataset.outfit;
      saveValue(STORAGE.outfit, outfit);
      ui.outfitButtons.forEach(function (item) {
        var active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", active ? "true" : "false");
      });
      render();
    });
  });

  document.addEventListener("keydown", function (event) {
    var direction = keyDirection(event.key);
    if (direction && state.status === "running") {
      event.preventDefault();
      move(direction);
    } else if (event.key === "Escape" && (state.status === "running" || state.status === "paused")) {
      event.preventDefault();
      togglePause();
    } else if ((event.key === "Enter" || event.key === " ") && !ui.overlay.hidden && document.activeElement === canvas) {
      event.preventDefault();
      handlePrimaryAction();
    }
  });

  canvas.addEventListener("pointerdown", function (event) {
    pointerStart = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointerup", function (event) {
    if (!pointerStart) {
      return;
    }
    var deltaX = event.clientX - pointerStart.x;
    var deltaY = event.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 18) {
      return;
    }
    move(Math.abs(deltaX) > Math.abs(deltaY) ? (deltaX > 0 ? "right" : "left") : (deltaY > 0 ? "down" : "up"));
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden && state.status === "running") {
      togglePause();
    }
  });

  ui.outfitButtons.forEach(function (button) {
    var active = button.dataset.outfit === outfit;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  updateLevelMenu();
  updateHud();
  showOverlay("start");
  render();
  window.requestAnimationFrame(frame);
})();
