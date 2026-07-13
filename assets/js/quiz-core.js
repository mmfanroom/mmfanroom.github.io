(function (root, factory) {
  "use strict";

  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.MMQuizCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

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

  function validateQuestions(questions) {
    if (!Array.isArray(questions) || questions.length < 20) {
      return false;
    }

    var ids = Object.create(null);
    return questions.every(function (question) {
      var valid = question &&
        typeof question.id === "string" && question.id.length > 0 &&
        typeof question.question === "string" && question.question.length > 0 &&
        Array.isArray(question.options) && question.options.length === 4 &&
        Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4 &&
        typeof question.explanation === "string" && question.explanation.length > 0 &&
        question.source && typeof question.source.url === "string";
      if (!valid || ids[question.id]) {
        return false;
      }
      ids[question.id] = true;
      return true;
    });
  }

  function createQuiz(questions, random) {
    if (!validateQuestions(questions)) {
      throw new Error("Quiz data must contain at least 20 valid, unique questions.");
    }
    return {
      questions: shuffle(questions, random),
      index: 0,
      score: 0,
      streak: 0,
      bestStreak: 0,
      selectedAnswer: null,
      answered: false,
      completed: false
    };
  }

  function currentQuestion(state) {
    return state.questions[state.index] || null;
  }

  function submitAnswer(state, answerIndex) {
    if (state.completed || state.answered || !Number.isInteger(answerIndex)) {
      return null;
    }
    var question = currentQuestion(state);
    if (!question || answerIndex < 0 || answerIndex >= question.options.length) {
      return null;
    }

    var correct = answerIndex === question.answer;
    state.selectedAnswer = answerIndex;
    state.answered = true;
    if (correct) {
      state.score += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
    } else {
      state.streak = 0;
    }

    return {
      correct: correct,
      selected: answerIndex,
      answer: question.answer,
      question: question
    };
  }

  function nextQuestion(state) {
    if (state.completed || !state.answered) {
      return false;
    }
    if (state.index >= state.questions.length - 1) {
      state.completed = true;
      return true;
    }

    state.index += 1;
    state.selectedAnswer = null;
    state.answered = false;
    return true;
  }

  function resultFor(score, total) {
    var percentage = total > 0 ? Math.round((score / total) * 100) : 0;
    if (percentage === 100) {
      return { percentage: percentage, title: "Ultimate Superfan", message: "A flawless run. You know every era." };
    }
    if (percentage >= 80) {
      return { percentage: percentage, title: "M&M Expert", message: "You know the big moments and the deep cuts." };
    }
    if (percentage >= 60) {
      return { percentage: percentage, title: "Rising Fan", message: "Strong score. A few classics are waiting for you." };
    }
    return { percentage: percentage, title: "New Fan Energy", message: "A great place to start. Explore the music and try again." };
  }

  return {
    shuffle: shuffle,
    validateQuestions: validateQuestions,
    createQuiz: createQuiz,
    currentQuestion: currentQuestion,
    submitAnswer: submitAnswer,
    nextQuestion: nextQuestion,
    resultFor: resultFor
  };
});
