const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../assets/js/song-match-core.js");

function makeSongs() {
  const songs = Array.from({ length: 13 }, (_, index) => ({
    title: `Song ${index + 1}`,
    youtube: `video-${index + 1}`,
    categories: [],
  }));

  [0, 1, 2, 3, 4].forEach((index) => songs[index].categories.push("New Fan Starter Pack"));
  [3, 4, 5, 6, 7].forEach((index) => songs[index].categories.push("Emotional Songs"));
  [0, 1, 4, 7, 8, 9, 10, 11].forEach((index) => songs[index].categories.push("Live Favorites"));
  return songs;
}

test("defines three progressively faster setlist levels", () => {
  assert.equal(Core.LEVELS.length, 3);
  assert.deepEqual(Core.LEVELS.map((level) => level.id), [1, 2, 3]);
  assert.ok(Core.LEVELS[2].duration < Core.LEVELS[0].duration);
  assert.ok(Core.LEVELS[2].targetCount > Core.LEVELS[0].targetCount);
});

test("validates the music data needed by every level", () => {
  assert.equal(Core.validateSongs(makeSongs()), true);
  assert.equal(Core.validateSongs(makeSongs().slice(0, 9)), false);

  const duplicate = makeSongs();
  duplicate[12].youtube = duplicate[0].youtube;
  assert.equal(Core.validateSongs(duplicate), false);
});

test("builds a shuffled deck with the correct target count", () => {
  const songs = Core.normalizeSongs(makeSongs());
  const level = Core.LEVELS[0];
  const deck = Core.buildDeck(songs, level, () => 0.5);

  assert.equal(deck.length, level.deckSize);
  assert.equal(deck.filter((song) => song.isTarget).length, level.targetCount);
  assert.equal(new Set(deck.map((song) => song.id)).size, deck.length);
});

test("creates a ready game and ignores selections before it starts", () => {
  const game = Core.createGame(makeSongs(), 0, 250, () => 0.5);
  const target = game.deck.find((song) => song.isTarget);

  assert.equal(game.status, "ready");
  assert.equal(game.score, 250);
  assert.equal(game.timeRemaining, 36);
  assert.equal(Core.selectSong(game, target.id).accepted, false);
});

test("correct songs build combo and cannot score twice", () => {
  const game = Core.createGame(makeSongs(), 0, 0, () => 0.5);
  const targets = game.deck.filter((song) => song.isTarget);
  Core.startGame(game);

  const first = Core.selectSong(game, targets[0].id);
  const second = Core.selectSong(game, targets[1].id);
  const duplicate = Core.selectSong(game, targets[0].id);

  assert.equal(first.points, 120);
  assert.equal(second.points, 140);
  assert.equal(game.combo, 2);
  assert.equal(game.bestCombo, 2);
  assert.equal(game.score, 260);
  assert.equal(duplicate.accepted, false);
});

test("a wrong song resets combo and removes three seconds", () => {
  const game = Core.createGame(makeSongs(), 0, 0, () => 0.5);
  const target = game.deck.find((song) => song.isTarget);
  const wrong = game.deck.find((song) => !song.isTarget);
  Core.startGame(game);
  Core.selectSong(game, target.id);

  const result = Core.selectSong(game, wrong.id);
  assert.equal(result.correct, false);
  assert.equal(result.penalty, 3);
  assert.equal(game.combo, 0);
  assert.equal(game.mistakes, 1);
  assert.equal(game.timeRemaining, 33);
});

test("finding every target completes the level with a time bonus", () => {
  const game = Core.createGame(makeSongs(), 0, 0, () => 0.5);
  const targets = game.deck.filter((song) => song.isTarget);
  Core.startGame(game);
  targets.forEach((song) => Core.selectSong(game, song.id));

  assert.equal(game.status, "levelComplete");
  assert.equal(game.foundCount, game.level.targetCount);
  assert.equal(game.score, 960);
});

test("the timer only runs while playing and can end the game", () => {
  const game = Core.createGame(makeSongs(), 0, 0, () => 0.5);
  Core.update(game, 5);
  assert.equal(game.timeRemaining, 36);

  Core.startGame(game);
  Core.update(game, 40);
  assert.equal(game.timeRemaining, 0);
  assert.equal(game.status, "gameOver");
});

test("the next level carries the current score", () => {
  const game = Core.createGame(makeSongs(), 0, 100, () => 0.5);
  Core.startGame(game);
  game.deck.filter((song) => song.isTarget).forEach((song) => Core.selectSong(game, song.id));

  const next = Core.nextLevel(game, () => 0.5);
  assert.equal(next.levelIndex, 1);
  assert.equal(next.score, game.score);
  assert.equal(next.status, "ready");
});
