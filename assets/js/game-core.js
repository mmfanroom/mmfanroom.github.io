(function (root, factory) {
  "use strict";

  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.StageRushCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var BOARD = Object.freeze({
    width: 480,
    height: 600,
    cols: 10,
    rows: 10,
    cellWidth: 48,
    cellHeight: 60
  });

  var HAZARD_SIZES = Object.freeze({
    case: [70, 34],
    cable: [82, 16],
    crew: [34, 48],
    spotlight: [54, 54],
    speaker: [52, 46],
    confetti: [64, 30],
    barrier: [78, 34],
    throwable: [38, 38]
  });

  var LEVELS = Object.freeze([
    {
      id: 1,
      name: "Backstage Warm-up",
      shortName: "Backstage",
      goal: "Reach the stage door",
      duration: 70,
      safeRows: [9, 6, 3, 0],
      palette: ["#08152a", "#111b36", "#38bdf8"],
      lanes: [
        { row: 8, type: "case", count: 3, speed: 48, direction: 1, offset: 10 },
        { row: 7, type: "cable", count: 3, speed: 42, direction: -1, offset: 80 },
        { row: 5, type: "crew", count: 3, speed: 52, direction: 1, offset: 34 },
        { row: 4, type: "case", count: 4, speed: 58, direction: -1, offset: 130 },
        { row: 2, type: "cable", count: 3, speed: 50, direction: 1, offset: 170 },
        { row: 1, type: "crew", count: 4, speed: 62, direction: -1, offset: 22 }
      ],
      collectibles: [
        { col: 1, row: 7, type: "note" },
        { col: 8, row: 5, type: "star" },
        { col: 3, row: 2, type: "note" }
      ]
    },
    {
      id: 2,
      name: "Arena Stage",
      shortName: "Arena",
      goal: "Cross to the catwalk",
      duration: 65,
      safeRows: [9, 5, 0],
      palette: ["#170b2d", "#25103c", "#ec4899"],
      lanes: [
        { row: 8, type: "speaker", count: 3, speed: 62, direction: -1, offset: 18 },
        { row: 7, type: "spotlight", count: 4, speed: 70, direction: 1, offset: 92 },
        { row: 6, type: "confetti", count: 4, speed: 76, direction: -1, offset: 35 },
        { row: 4, type: "barrier", count: 3, speed: 66, direction: 1, offset: 145 },
        { row: 3, type: "spotlight", count: 4, speed: 82, direction: -1, offset: 14 },
        { row: 2, type: "speaker", count: 4, speed: 74, direction: 1, offset: 110 },
        { row: 1, type: "confetti", count: 5, speed: 88, direction: -1, offset: 52 }
      ],
      collectibles: [
        { col: 7, row: 8, type: "star" },
        { col: 2, row: 6, type: "note" },
        { col: 8, row: 3, type: "note" },
        { col: 4, row: 1, type: "star" }
      ]
    },
    {
      id: 3,
      name: "Festival Finale",
      shortName: "Festival",
      goal: "Reach the finale mic",
      duration: 60,
      safeRows: [9, 5, 0],
      palette: ["#090f2f", "#22114a", "#a855f7"],
      lanes: [
        { row: 8, type: "spotlight", count: 4, speed: 82, direction: 1, offset: 30 },
        { row: 7, type: "throwable", count: 5, speed: 92, direction: -1, offset: 108 },
        { row: 6, type: "barrier", count: 4, speed: 88, direction: 1, offset: 8 },
        { row: 4, type: "confetti", count: 5, speed: 104, direction: -1, offset: 75 },
        { row: 3, type: "speaker", count: 4, speed: 94, direction: 1, offset: 135 },
        { row: 2, type: "throwable", count: 6, speed: 112, direction: -1, offset: 36 },
        { row: 1, type: "spotlight", count: 5, speed: 108, direction: 1, offset: 90 }
      ],
      collectibles: [
        { col: 2, row: 8, type: "note" },
        { col: 7, row: 6, type: "star" },
        { col: 1, row: 4, type: "star" },
        { col: 8, row: 2, type: "note" },
        { col: 5, row: 1, type: "star" }
      ]
    }
  ]);

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getLevel(index) {
    return LEVELS[clamp(index, 0, LEVELS.length - 1)];
  }

  function makeHazards(level) {
    var hazards = [];
    level.lanes.forEach(function (lane, laneIndex) {
      var size = HAZARD_SIZES[lane.type];
      var travel = BOARD.width + size[0];
      var spacing = travel / lane.count;

      for (var i = 0; i < lane.count; i += 1) {
        hazards.push({
          id: level.id + "-" + laneIndex + "-" + i,
          row: lane.row,
          type: lane.type,
          x: ((lane.offset + i * spacing) % travel) - size[0],
          y: lane.row * BOARD.cellHeight + (BOARD.cellHeight - size[1]) / 2,
          width: size[0],
          height: size[1],
          speed: lane.speed * lane.direction,
          travel: travel
        });
      }
    });
    return hazards;
  }

  function makeCollectibles(level) {
    return level.collectibles.map(function (item, index) {
      return {
        id: level.id + "-collectible-" + index,
        col: item.col,
        row: item.row,
        type: item.type,
        collected: false
      };
    });
  }

  function createGame(levelIndex, carriedScore) {
    var safeIndex = clamp(Number(levelIndex) || 0, 0, LEVELS.length - 1);
    var level = getLevel(safeIndex);
    return {
      status: "ready",
      levelIndex: safeIndex,
      level: level,
      score: Math.max(0, Number(carriedScore) || 0),
      levelStartScore: Math.max(0, Number(carriedScore) || 0),
      lives: 3,
      timeRemaining: level.duration,
      elapsed: 0,
      invulnerable: 0,
      hits: 0,
      furthestRow: BOARD.rows - 1,
      checkpoint: { col: 4, row: BOARD.rows - 1 },
      player: { col: 4, row: BOARD.rows - 1 },
      hazards: makeHazards(level),
      collectibles: makeCollectibles(level)
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

  function collectAtPlayer(state) {
    state.collectibles.forEach(function (item) {
      if (!item.collected && item.col === state.player.col && item.row === state.player.row) {
        item.collected = true;
        state.score += item.type === "star" ? 125 : 75;
      }
    });
  }

  function movePlayer(state, deltaCol, deltaRow) {
    if (state.status !== "running") {
      return state;
    }

    var previousRow = state.player.row;
    state.player.col = clamp(state.player.col + deltaCol, 0, BOARD.cols - 1);
    state.player.row = clamp(state.player.row + deltaRow, 0, BOARD.rows - 1);

    if (state.player.row < previousRow && state.player.row < state.furthestRow) {
      state.score += 10;
      state.furthestRow = state.player.row;
    }

    if (state.level.safeRows.indexOf(state.player.row) !== -1) {
      state.checkpoint = { col: state.player.col, row: state.player.row };
    }

    collectAtPlayer(state);

    if (state.player.row === 0) {
      state.score += 500 + Math.ceil(state.timeRemaining) * 5 + state.lives * 100;
      state.status = "levelComplete";
    }
    return state;
  }

  function playerBounds(state) {
    return {
      x: state.player.col * BOARD.cellWidth + 10,
      y: state.player.row * BOARD.cellHeight + 9,
      width: BOARD.cellWidth - 20,
      height: BOARD.cellHeight - 18
    };
  }

  function overlaps(a, b) {
    return a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y;
  }

  function registerHit(state) {
    if (state.invulnerable > 0 || state.status !== "running") {
      return false;
    }

    state.lives -= 1;
    state.hits += 1;
    if (state.lives <= 0) {
      state.status = "gameOver";
      return true;
    }

    state.player = { col: state.checkpoint.col, row: state.checkpoint.row };
    state.invulnerable = 0.9;
    return true;
  }

  function updateHazard(hazard, deltaSeconds) {
    hazard.x += hazard.speed * deltaSeconds;
    if (hazard.speed > 0 && hazard.x > BOARD.width) {
      hazard.x -= hazard.travel;
    } else if (hazard.speed < 0 && hazard.x + hazard.width < 0) {
      hazard.x += hazard.travel;
    }
  }

  function update(state, deltaSeconds) {
    if (state.status !== "running") {
      return state;
    }

    var delta = clamp(Number(deltaSeconds) || 0, 0, 0.1);
    state.elapsed += delta;
    state.timeRemaining = Math.max(0, state.timeRemaining - delta);
    state.invulnerable = Math.max(0, state.invulnerable - delta);

    state.hazards.forEach(function (hazard) {
      updateHazard(hazard, delta);
    });

    if (state.timeRemaining <= 0) {
      state.status = "gameOver";
      return state;
    }

    if (state.invulnerable <= 0) {
      var player = playerBounds(state);
      for (var i = 0; i < state.hazards.length; i += 1) {
        if (overlaps(player, state.hazards[i])) {
          registerHit(state);
          break;
        }
      }
    }
    return state;
  }

  function nextLevel(state) {
    if (state.status !== "levelComplete" || state.levelIndex >= LEVELS.length - 1) {
      return state;
    }
    return createGame(state.levelIndex + 1, state.score);
  }

  return {
    BOARD: BOARD,
    LEVELS: LEVELS,
    HAZARD_SIZES: HAZARD_SIZES,
    clamp: clamp,
    createGame: createGame,
    startGame: startGame,
    togglePause: togglePause,
    movePlayer: movePlayer,
    update: update,
    nextLevel: nextLevel,
    registerHit: registerHit,
    overlaps: overlaps,
    playerBounds: playerBounds
  };
});
