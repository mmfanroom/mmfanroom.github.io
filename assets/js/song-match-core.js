(function (root, factory) {
  "use strict";

  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.SetlistSprintCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var LEVELS = Object.freeze([
    Object.freeze({
      id: 1,
      name: "Starter Lights",
      shortName: "Starter",
      category: "New Fan Starter Pack",
      targetCount: 4,
      deckSize: 8,
      duration: 36
    }),
    Object.freeze({
      id: 2,
      name: "Afterglow",
      shortName: "Emotional",
      category: "Emotional Songs",
      targetCount: 4,
      deckSize: 9,
      duration: 32
    }),
    Object.freeze({
      id: 3,
      name: "Arena Rush",
      shortName: "Live",
      category: "Live Favorites",
      targetCount: 5,
      deckSize: 10,
      duration: 28
    })
  ]);

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function shuffle(items, random) {
    var result = items.slice();
    var rng = typeof random === "function" ? random : Math.random;
    for (var index = result.length - 1; index > 0; index -= 1) {
      var swapIndex = Math.floor(rng() * (index + 1));
      var temporary = result[index];
      result[index] = result[swapIndex];
      result[swapIndex] = temporary;
    }
    return result;
  }

  function normalizeSongs(songs) {
    if (!Array.isArray(songs)) {
      return [];
    }
    return songs.filter(function (song) {
      return song &&
        typeof song.title === "string" && song.title.length > 0 &&
        typeof song.youtube === "string" && song.youtube.length > 0 &&
        Array.isArray(song.categories);
    }).map(function (song) {
      return {
        id: song.youtube,
        title: song.title,
        youtube: song.youtube,
        categories: song.categories.slice()
      };
    });
  }

  function validateSongs(songs) {
    var normalized = normalizeSongs(songs);
    if (normalized.length < 10) {
      return false;
    }
    var ids = Object.create(null);
    if (!normalized.every(function (song) {
      if (ids[song.id]) {
        return false;
      }
      ids[song.id] = true;
      return true;
    })) {
      return false;
    }
    return LEVELS.every(function (level) {
      var targets = normalized.filter(function (song) {
        return song.categories.indexOf(level.category) !== -1;
      });
      var distractors = normalized.length - targets.length;
      return targets.length >= level.targetCount &&
        distractors >= level.deckSize - level.targetCount;
    });
  }

  function buildDeck(songs, level, random) {
    var targets = shuffle(songs.filter(function (song) {
      return song.categories.indexOf(level.category) !== -1;
    }), random).slice(0, level.targetCount);
    var distractors = shuffle(songs.filter(function (song) {
      return song.categories.indexOf(level.category) === -1;
    }), random).slice(0, level.deckSize - level.targetCount);

    return shuffle(targets.map(function (song) {
      return Object.assign({}, song, { isTarget: true });
    }).concat(distractors.map(function (song) {
      return Object.assign({}, song, { isTarget: false });
    })), random);
  }

  function createGame(rawSongs, levelIndex, carriedScore, random) {
    if (!validateSongs(rawSongs)) {
      throw new Error("Setlist Sprint needs at least 10 valid songs across all game categories.");
    }
    var songs = normalizeSongs(rawSongs);
    var safeIndex = clamp(Number(levelIndex) || 0, 0, LEVELS.length - 1);
    var level = LEVELS[safeIndex];
    var deck = buildDeck(songs, level, random);

    return {
      status: "ready",
      levelIndex: safeIndex,
      level: level,
      songs: songs,
      deck: deck,
      score: Math.max(0, Number(carriedScore) || 0),
      levelStartScore: Math.max(0, Number(carriedScore) || 0),
      combo: 0,
      bestCombo: 0,
      mistakes: 0,
      foundCount: 0,
      found: Object.create(null),
      timeRemaining: level.duration
    };
  }

  function startGame(state) {
    if (state.status === "ready" || state.status === "paused") {
      state.status = "running";
    }
    return state;
  }

  function togglePause(state) {
    if (state.status === "running") {
      state.status = "paused";
    } else if (state.status === "paused") {
      state.status = "running";
    }
    return state;
  }

  function selectSong(state, songId) {
    if (state.status !== "running" || state.found[songId]) {
      return { accepted: false };
    }
    var song = state.deck.find(function (item) { return item.id === songId; });
    if (!song) {
      return { accepted: false };
    }

    if (!song.isTarget) {
      state.combo = 0;
      state.mistakes += 1;
      state.timeRemaining = Math.max(0, state.timeRemaining - 3);
      if (state.timeRemaining === 0) {
        state.status = "gameOver";
      }
      return { accepted: true, correct: false, song: song, penalty: 3 };
    }

    state.found[songId] = true;
    state.foundCount += 1;
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    var points = 100 + state.combo * 20;
    state.score += points;
    var complete = state.foundCount === state.level.targetCount;
    var bonus = 0;
    if (complete) {
      bonus = Math.ceil(state.timeRemaining) * 10;
      state.score += bonus;
      state.status = "levelComplete";
    }
    return {
      accepted: true,
      correct: true,
      song: song,
      points: points,
      complete: complete,
      bonus: bonus
    };
  }

  function update(state, seconds) {
    if (state.status !== "running") {
      return state;
    }
    state.timeRemaining = Math.max(0, state.timeRemaining - Math.max(0, Number(seconds) || 0));
    if (state.timeRemaining === 0) {
      state.status = "gameOver";
      state.combo = 0;
    }
    return state;
  }

  function nextLevel(state, random) {
    if (state.status !== "levelComplete" || state.levelIndex >= LEVELS.length - 1) {
      return null;
    }
    return createGame(state.songs, state.levelIndex + 1, state.score, random);
  }

  return {
    LEVELS: LEVELS,
    clamp: clamp,
    shuffle: shuffle,
    normalizeSongs: normalizeSongs,
    validateSongs: validateSongs,
    buildDeck: buildDeck,
    createGame: createGame,
    startGame: startGame,
    togglePause: togglePause,
    selectSong: selectSong,
    update: update,
    nextLevel: nextLevel
  };
});
