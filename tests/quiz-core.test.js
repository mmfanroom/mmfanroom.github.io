const test = require("node:test");
const assert = require("node:assert/strict");

const QuizCore = require("../assets/js/quiz-core.js");

function makeQuestions(count = 20) {
  return Array.from({ length: count }, (_, index) => ({
    id: `question-${index + 1}`,
    category: "Test",
    question: `Question ${index + 1}?`,
    options: ["A", "B", "C", "D"],
    answer: index % 4,
    explanation: `Explanation ${index + 1}`,
    source: {
      label: "Test source",
      url: "https://example.com/source",
    },
  }));
}

test("validates a complete question set", () => {
  assert.equal(QuizCore.validateQuestions(makeQuestions(20)), true);
});

test("rejects fewer than 20 questions and duplicate ids", () => {
  assert.equal(QuizCore.validateQuestions(makeQuestions(19)), false);

  const questions = makeQuestions(20);
  questions[19].id = questions[0].id;
  assert.equal(QuizCore.validateQuestions(questions), false);
});

test("shuffles without mutating the original array", () => {
  const original = [1, 2, 3, 4];
  const shuffled = QuizCore.shuffle(original, () => 0);

  assert.deepEqual(original, [1, 2, 3, 4]);
  assert.deepEqual(shuffled, [2, 3, 4, 1]);
});

test("scores correct answers and prevents duplicate submissions", () => {
  const state = QuizCore.createQuiz(makeQuestions(20), () => 0.999);
  const question = QuizCore.currentQuestion(state);

  const firstResult = QuizCore.submitAnswer(state, question.answer);
  const duplicateResult = QuizCore.submitAnswer(state, question.answer);

  assert.equal(firstResult.correct, true);
  assert.equal(duplicateResult, null);
  assert.equal(state.score, 1);
  assert.equal(state.streak, 1);
  assert.equal(state.bestStreak, 1);
});

test("resets the current streak after a wrong answer", () => {
  const state = QuizCore.createQuiz(makeQuestions(20), () => 0.999);
  let question = QuizCore.currentQuestion(state);

  QuizCore.submitAnswer(state, question.answer);
  QuizCore.nextQuestion(state);
  question = QuizCore.currentQuestion(state);
  QuizCore.submitAnswer(state, (question.answer + 1) % 4);

  assert.equal(state.score, 1);
  assert.equal(state.streak, 0);
  assert.equal(state.bestStreak, 1);
});

test("only advances after an answer and completes after the final question", () => {
  const state = QuizCore.createQuiz(makeQuestions(20), () => 0.999);

  assert.equal(QuizCore.nextQuestion(state), false);

  while (!state.completed) {
    const question = QuizCore.currentQuestion(state);
    QuizCore.submitAnswer(state, question.answer);
    QuizCore.nextQuestion(state);
  }

  assert.equal(state.index, 19);
  assert.equal(state.score, 20);
  assert.equal(state.completed, true);
});

test("returns the correct result tier", () => {
  assert.equal(QuizCore.resultFor(20, 20).title, "Ultimate Superfan");
  assert.equal(QuizCore.resultFor(16, 20).title, "M&M Expert");
  assert.equal(QuizCore.resultFor(12, 20).title, "Rising Fan");
  assert.equal(QuizCore.resultFor(11, 20).title, "New Fan Energy");
});
