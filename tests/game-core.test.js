const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../assets/js/game-core.js");

test("defines three increasingly difficult levels", () => {
  assert.equal(Core.LEVELS.length, 3);
  assert.deepEqual(Core.LEVELS.map((level) => level.id), [1, 2, 3]);
  assert.ok(Core.LEVELS[2].lanes[0].speed > Core.LEVELS[0].lanes[0].speed);

  const types = new Set(Core.LEVELS.flatMap((level) => level.lanes.map((lane) => lane.type)));
  assert.ok(types.size >= 5);
});

test("every hazard lane leaves a passable gap and avoids safe rows", () => {
  const playerWidth = Core.BOARD.cellWidth - 20;

  Core.LEVELS.forEach((level) => {
    level.lanes.forEach((lane) => {
      const hazardWidth = Core.HAZARD_SIZES[lane.type][0];
      const spacing = (Core.BOARD.width + hazardWidth) / lane.count;
      assert.ok(spacing - hazardWidth > playerWidth, `${level.name} row ${lane.row} must remain passable`);
      assert.equal(level.safeRows.includes(lane.row), false);
    });
  });
});

test("creates a ready game at the bottom checkpoint", () => {
  const game = Core.createGame(0);
  assert.equal(game.status, "ready");
  assert.equal(game.player.row, Core.BOARD.rows - 1);
  assert.equal(game.checkpoint.row, Core.BOARD.rows - 1);
  assert.equal(game.lives, 3);
  assert.equal(game.timeRemaining, 70);
});

test("movement stays within the board and only runs while playing", () => {
  const game = Core.createGame(0);
  Core.movePlayer(game, -10, -10);
  assert.deepEqual(game.player, { col: 4, row: 9 });

  Core.startGame(game);
  Core.movePlayer(game, -10, 0);
  Core.movePlayer(game, 0, -10);
  assert.deepEqual(game.player, { col: 0, row: 0 });
});

test("safe rows update the checkpoint", () => {
  const game = Core.createGame(0);
  Core.startGame(game);
  Core.movePlayer(game, 1, -1);
  Core.movePlayer(game, 0, -1);
  Core.movePlayer(game, 0, -1);
  assert.deepEqual(game.checkpoint, { col: 5, row: 6 });
});

test("a collision removes energy and returns the player to the checkpoint", () => {
  const game = Core.createGame(0);
  Core.startGame(game);
  Core.movePlayer(game, 0, -1);
  game.hazards = [{
    x: game.player.col * Core.BOARD.cellWidth,
    y: game.player.row * Core.BOARD.cellHeight,
    width: Core.BOARD.cellWidth,
    height: Core.BOARD.cellHeight,
    speed: 0,
    travel: Core.BOARD.width
  }];

  Core.update(game, 0.016);
  assert.equal(game.lives, 2);
  assert.deepEqual(game.player, game.checkpoint);
  assert.ok(game.invulnerable > 0);
});

test("three collisions end the run", () => {
  const game = Core.createGame(0);
  Core.startGame(game);
  Core.registerHit(game);
  game.invulnerable = 0;
  Core.registerHit(game);
  game.invulnerable = 0;
  Core.registerHit(game);
  assert.equal(game.status, "gameOver");
  assert.equal(game.lives, 0);
});

test("collecting a note awards points once", () => {
  const game = Core.createGame(0);
  Core.startGame(game);
  game.collectibles = [{ id: "note", col: 4, row: 8, type: "note", collected: false }];
  Core.movePlayer(game, 0, -1);
  const firstScore = game.score;
  Core.movePlayer(game, 0, 1);
  Core.movePlayer(game, 0, -1);
  assert.equal(firstScore, 85);
  assert.equal(game.score, 85);
});

test("reaching row zero completes a level and the next level carries score", () => {
  const game = Core.createGame(0, 100);
  Core.startGame(game);
  for (let row = 9; row > 0; row -= 1) {
    Core.movePlayer(game, 0, -1);
  }
  assert.equal(game.status, "levelComplete");
  assert.ok(game.score > 100);

  const levelTwo = Core.nextLevel(game);
  assert.equal(levelTwo.levelIndex, 1);
  assert.equal(levelTwo.score, game.score);
  assert.equal(levelTwo.status, "ready");
});

test("timer reaches game over", () => {
  const game = Core.createGame(2);
  Core.startGame(game);
  game.timeRemaining = 0.05;
  Core.update(game, 0.1);
  assert.equal(game.status, "gameOver");
  assert.equal(game.timeRemaining, 0);
});
