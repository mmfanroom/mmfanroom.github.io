(function () {
  "use strict";

  var root = document.getElementById("setlist-sprint");
  var dataNode = document.getElementById("setlist-data");
  var Core = window.SetlistSprintCore;
  if (!root || !dataNode || !Core) {
    return;
  }

  var ui = {
    level: document.getElementById("setlist-level"),
    score: document.getElementById("setlist-score"),
    time: document.getElementById("setlist-time"),
    combo: document.getElementById("setlist-combo"),
    command: document.getElementById("setlist-command"),
    found: document.getElementById("setlist-found"),
    progress: document.getElementById("setlist-progress-bar"),
    category: document.getElementById("setlist-category"),
    cards: document.getElementById("setlist-cards"),
    overlay: document.getElementById("setlist-overlay"),
    overlayTag: document.getElementById("setlist-overlay-tag"),
    overlayTitle: document.getElementById("setlist-overlay-title"),
    overlayCopy: document.getElementById("setlist-overlay-copy"),
    primary: document.getElementById("setlist-primary"),
    primaryLabel: document.querySelector("#setlist-primary span"),
    pause: document.getElementById("setlist-pause"),
    restart: document.getElementById("setlist-restart"),
    sound: document.getElementById("setlist-sound"),
    soundOff: document.querySelector("#setlist-sound .sound-off"),
    soundOn: document.querySelector("#setlist-sound .sound-on"),
    unlocked: document.getElementById("setlist-unlocked"),
    levelButtons: Array.prototype.slice.call(document.querySelectorAll("[data-setlist-level]")),
    best: document.getElementById("setlist-best"),
    bestCombo: document.getElementById("setlist-best-combo"),
    misses: document.getElementById("setlist-misses"),
    currentSet: document.getElementById("setlist-current-set"),
    announcer: document.getElementById("setlist-announcer")
  };

  var STORAGE = {
    unlocked: "setlistSprint.unlocked",
    best: "setlistSprint.best",
    bestCombo: "setlistSprint.bestCombo"
  };
  var songs;
  var state;
  var actionMode = "start";
  var unlocked = readNumber(STORAGE.unlocked, 1);
  var bestScore = readNumber(STORAGE.best, 0);
  var allTimeCombo = readNumber(STORAGE.bestCombo, 0);
  var soundEnabled = false;
  var audioContext = null;
  var lastFrame = performance.now();

  function readNumber(key, fallback) {
    try {
      var value = Number(window.localStorage.getItem(key));
      return Number.isFinite(value) && value >= 0 ? value : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveValue(key, value) {
    try {
      window.localStorage.setItem(key, String(value));
    } catch (error) {
      // Storage is optional; gameplay does not depend on it.
    }
  }

  function setText(element, value) {
    if (element) {
      element.textContent = String(value);
    }
  }

  function formatScore(value) {
    return String(Math.max(0, Math.round(value))).padStart(4, "0");
  }

  function shortCategory(category) {
    return category.replace("New Fan ", "").replace(" Songs", "").replace(" Favorites", "");
  }

  function announce(message) {
    setText(ui.announcer, message);
  }

  function updateRecords() {
    if (state.score > bestScore) {
      bestScore = Math.round(state.score);
      saveValue(STORAGE.best, bestScore);
    }
    if (state.bestCombo > allTimeCombo) {
      allTimeCombo = state.bestCombo;
      saveValue(STORAGE.bestCombo, allTimeCombo);
    }
  }

  function updateHud() {
    var progress = state.foundCount / state.level.targetCount * 100;
    setText(ui.level, (state.levelIndex + 1) + " / " + Core.LEVELS.length);
    setText(ui.score, formatScore(state.score));
    setText(ui.time, Math.ceil(state.timeRemaining));
    setText(ui.combo, "x" + state.combo);
    setText(ui.command, "Find " + state.level.targetCount + " tracks");
    setText(ui.found, state.foundCount + " / " + state.level.targetCount);
    setText(ui.category, state.level.category);
    setText(ui.currentSet, shortCategory(state.level.category));
    setText(ui.best, formatScore(bestScore));
    setText(ui.bestCombo, "x" + allTimeCombo);
    setText(ui.misses, state.mistakes);
    ui.progress.style.width = progress + "%";
    ui.time.classList.toggle("urgent", state.timeRemaining <= 8 && state.status === "running");
    root.dataset.gameStatus = state.status;
    root.dataset.gameLevel = String(state.levelIndex + 1);
    root.dataset.found = String(state.foundCount);
    root.dataset.score = String(Math.round(state.score));
  }

  function updateLevelMenu() {
    unlocked = Core.clamp(unlocked, 1, Core.LEVELS.length);
    setText(ui.unlocked, unlocked + " / " + Core.LEVELS.length + " open");
    ui.levelButtons.forEach(function (button, index) {
      var available = index < unlocked;
      var active = index === state.levelIndex;
      button.disabled = !available;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
      setText(button.querySelector(".setlist-level-state"), active ? "Selected" : (available ? "Open" : "Locked"));
    });
  }

  function makeCard(song) {
    var button = document.createElement("button");
    var visual = document.createElement("span");
    var image = document.createElement("img");
    var badge = document.createElement("span");
    var title = document.createElement("strong");

    button.type = "button";
    button.className = "setlist-card";
    button.dataset.songId = song.id;
    button.setAttribute("aria-label", song.title);
    button.setAttribute("aria-pressed", "false");
    visual.className = "setlist-card-visual";
    image.src = "https://i.ytimg.com/vi/" + encodeURIComponent(song.youtube) + "/mqdefault.jpg";
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    badge.className = "setlist-card-badge";
    badge.setAttribute("aria-hidden", "true");
    title.textContent = song.title;
    visual.appendChild(image);
    visual.appendChild(badge);
    button.appendChild(visual);
    button.appendChild(title);
    button.addEventListener("click", function () { pickSong(button, song.id); });
    return button;
  }

  function renderDeck() {
    ui.cards.replaceChildren();
    state.deck.forEach(function (song) {
      ui.cards.appendChild(makeCard(song));
    });
  }

  function lockCards() {
    Array.prototype.forEach.call(ui.cards.querySelectorAll(".setlist-card"), function (button) {
      button.disabled = true;
    });
  }

  function pickSong(button, songId) {
    var outcome = Core.selectSong(state, songId);
    if (!outcome.accepted) {
      return;
    }

    if (outcome.correct) {
      button.classList.add("found");
      button.disabled = true;
      button.setAttribute("aria-pressed", "true");
      button.querySelector(".setlist-card-badge").textContent = "+" + outcome.points;
      playTone(520 + state.combo * 55, 0.08, "square");
      announce(outcome.song.title + " found. Combo " + state.combo + ".");
    } else {
      button.classList.add("wrong");
      button.disabled = true;
      button.querySelector(".setlist-card-badge").textContent = "-3s";
      playTone(135, 0.12, "sawtooth");
      announce(outcome.song.title + " is not in this set. Three seconds removed.");
      window.setTimeout(function () {
        button.classList.remove("wrong");
        button.querySelector(".setlist-card-badge").textContent = "";
        if (state.status === "running") {
          button.disabled = false;
        }
      }, 520);
    }

    updateRecords();
    updateHud();
    if (state.status === "levelComplete") {
      finishLevel(outcome.bonus);
    } else if (state.status === "gameOver") {
      finishRun();
    }
  }

  function showOverlay(mode, bonus) {
    actionMode = mode;
    ui.overlay.hidden = false;
    if (mode === "start") {
      setText(ui.overlayTag, "Level " + (state.levelIndex + 1));
      setText(ui.overlayTitle, state.level.name);
      setText(ui.overlayCopy, "Find " + state.level.targetCount + " " + shortCategory(state.level.category) + " tracks.");
      setText(ui.primaryLabel, "Start level");
    } else if (mode === "resume") {
      setText(ui.overlayTag, "Level " + (state.levelIndex + 1));
      setText(ui.overlayTitle, "Paused");
      setText(ui.overlayCopy, "Score " + formatScore(state.score) + ".");
      setText(ui.primaryLabel, "Resume");
    } else if (mode === "retry") {
      setText(ui.overlayTag, "Time up");
      setText(ui.overlayTitle, "Set unfinished");
      setText(ui.overlayCopy, state.foundCount + " of " + state.level.targetCount + " tracks found.");
      setText(ui.primaryLabel, "Try again");
    } else if (mode === "next") {
      setText(ui.overlayTag, "Level clear");
      setText(ui.overlayTitle, state.level.name + " complete");
      setText(ui.overlayCopy, "+" + bonus + " time bonus. Score " + formatScore(state.score) + ".");
      setText(ui.primaryLabel, "Next level");
    } else if (mode === "victory") {
      setText(ui.overlayTag, "Tour complete");
      setText(ui.overlayTitle, "Setlist mastered");
      setText(ui.overlayCopy, "Final score " + formatScore(state.score) + ". Best combo x" + state.bestCombo + ".");
      setText(ui.primaryLabel, "Play again");
    }
  }

  function hideOverlay() {
    ui.overlay.hidden = true;
  }

  function startLevel() {
    Core.startGame(state);
    hideOverlay();
    updateHud();
    lastFrame = performance.now();
    announce(state.level.name + " started.");
    playTone(440, 0.08, "square");
    var firstCard = ui.cards.querySelector(".setlist-card:not(:disabled)");
    if (firstCard) {
      firstCard.focus({ preventScroll: true });
    }
  }

  function loadLevel(index, carriedScore) {
    state = Core.createGame(songs, index, carriedScore || 0);
    renderDeck();
    updateLevelMenu();
    updateHud();
    showOverlay("start");
  }

  function finishLevel(bonus) {
    lockCards();
    unlocked = Math.max(unlocked, Math.min(Core.LEVELS.length, state.levelIndex + 2));
    saveValue(STORAGE.unlocked, unlocked);
    updateRecords();
    updateLevelMenu();
    updateHud();
    playSuccess();
    if (state.levelIndex === Core.LEVELS.length - 1) {
      showOverlay("victory", bonus);
      announce("Tour complete. Final score " + state.score + ".");
    } else {
      showOverlay("next", bonus);
      announce(state.level.name + " complete. Next level open.");
    }
    ui.primary.focus({ preventScroll: true });
  }

  function finishRun() {
    lockCards();
    updateRecords();
    updateHud();
    showOverlay("retry");
    announce("Time up. " + state.foundCount + " tracks found.");
    ui.primary.focus({ preventScroll: true });
  }

  function handlePrimary() {
    if (actionMode === "start") {
      startLevel();
    } else if (actionMode === "resume") {
      Core.togglePause(state);
      hideOverlay();
      updateHud();
      lastFrame = performance.now();
    } else if (actionMode === "retry") {
      loadLevel(state.levelIndex, state.levelStartScore);
      startLevel();
    } else if (actionMode === "next") {
      var next = Core.nextLevel(state);
      if (next) {
        state = next;
        renderDeck();
        updateLevelMenu();
        updateHud();
        showOverlay("start");
      }
    } else if (actionMode === "victory") {
      loadLevel(0, 0);
    }
  }

  function pauseGame() {
    if (state.status !== "running") {
      return;
    }
    Core.togglePause(state);
    updateHud();
    showOverlay("resume");
    announce("Game paused.");
    ui.primary.focus({ preventScroll: true });
  }

  function restartLevel() {
    loadLevel(state.levelIndex, state.levelStartScore);
    announce("Level restarted.");
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    ui.sound.setAttribute("aria-pressed", soundEnabled ? "true" : "false");
    ui.sound.setAttribute("aria-label", soundEnabled ? "Turn sound off" : "Turn sound on");
    ui.sound.title = soundEnabled ? "Turn sound off" : "Turn sound on";
    ui.soundOff.hidden = soundEnabled;
    ui.soundOn.hidden = !soundEnabled;
    if (soundEnabled) {
      playTone(440, 0.06, "square");
    }
  }

  function playTone(frequency, duration, type) {
    if (!soundEnabled) {
      return;
    }
    try {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      var oscillator = audioContext.createOscillator();
      var gain = audioContext.createGain();
      oscillator.type = type || "square";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.035, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      soundEnabled = false;
    }
  }

  function playSuccess() {
    playTone(520, 0.08, "square");
    window.setTimeout(function () { playTone(660, 0.1, "square"); }, 90);
  }

  function frame(now) {
    var seconds = Math.min(0.25, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    var previousStatus = state ? state.status : "ready";
    if (state) {
      Core.update(state, seconds);
      if (state.status === "running") {
        updateHud();
      } else if (state.status === "gameOver" && previousStatus !== "gameOver") {
        finishRun();
      }
    }
    window.requestAnimationFrame(frame);
  }

  function showDataError() {
    setText(ui.category, "Game unavailable");
    setText(ui.overlayTitle, "Songs could not be loaded");
    setText(ui.overlayCopy, "Refresh the page and try again.");
    ui.primary.disabled = true;
    root.dataset.gameStatus = "error";
  }

  ui.primary.addEventListener("click", handlePrimary);
  ui.pause.addEventListener("click", pauseGame);
  ui.restart.addEventListener("click", restartLevel);
  ui.sound.addEventListener("click", toggleSound);
  ui.levelButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      var index = Number(button.dataset.setlistLevel);
      if (index < unlocked) {
        loadLevel(index, 0);
      }
    });
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && state && state.status === "running") {
      pauseGame();
    }
  });
  root.addEventListener("keydown", function (event) {
    if (event.key.toLowerCase() === "p") {
      event.preventDefault();
      pauseGame();
    } else if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      restartLevel();
    }
  });

  try {
    songs = JSON.parse(dataNode.textContent);
    unlocked = Core.clamp(unlocked, 1, Core.LEVELS.length);
    state = Core.createGame(songs, 0, 0);
    renderDeck();
    updateLevelMenu();
    updateHud();
    showOverlay("start");
    window.requestAnimationFrame(frame);
  } catch (error) {
    showDataError();
  }
})();
