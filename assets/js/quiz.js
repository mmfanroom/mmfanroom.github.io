(function () {
  "use strict";

  var root = document.getElementById("fan-quiz");
  var Core = window.MMQuizCore;
  var dataNode = document.getElementById("quiz-data");
  if (!root || !Core || !dataNode) {
    return;
  }

  var ui = {
    position: document.getElementById("quiz-position"),
    category: document.getElementById("quiz-category"),
    percent: document.getElementById("quiz-percent"),
    progress: document.getElementById("quiz-progress-bar"),
    questionPanel: document.getElementById("quiz-question-panel"),
    question: document.getElementById("quiz-question"),
    answers: document.getElementById("quiz-answers"),
    feedback: document.getElementById("quiz-feedback"),
    feedbackTitle: document.getElementById("quiz-feedback-title"),
    explanation: document.getElementById("quiz-explanation"),
    source: document.getElementById("quiz-source"),
    sourceLabel: document.getElementById("quiz-source-label"),
    nextRow: document.getElementById("quiz-next-row"),
    next: document.getElementById("quiz-next"),
    nextLabel: document.querySelector("#quiz-next span"),
    result: document.getElementById("quiz-result"),
    finalScore: document.getElementById("quiz-final-score"),
    resultTitle: document.getElementById("quiz-result-title"),
    resultMessage: document.getElementById("quiz-result-message"),
    restart: document.getElementById("quiz-restart"),
    score: document.getElementById("quiz-score"),
    streak: document.getElementById("quiz-streak"),
    best: document.getElementById("quiz-best"),
    announcer: document.getElementById("quiz-announcer")
  };
  var letters = ["A", "B", "C", "D"];
  var questions;
  var state;
  var bestScore = readBest();

  function readBest() {
    try {
      var value = Number(window.localStorage.getItem("mmFanQuiz.best"));
      return Number.isFinite(value) && value >= 0 ? value : 0;
    } catch (error) {
      return 0;
    }
  }

  function saveBest() {
    try {
      window.localStorage.setItem("mmFanQuiz.best", String(bestScore));
    } catch (error) {
      // The quiz works without storage when the browser blocks it.
    }
  }

  function setText(element, value) {
    if (element) {
      element.textContent = String(value);
    }
  }

  function announce(message) {
    setText(ui.announcer, message);
  }

  function updateStats() {
    setText(ui.score, state.score);
    setText(ui.streak, state.streak);
    setText(ui.best, bestScore);
    root.dataset.quizStatus = state.completed ? "result" : (state.answered ? "answered" : "question");
    root.dataset.questionNumber = String(state.index + 1);
    root.dataset.score = String(state.score);
  }

  function makeAnswerButton(option, index) {
    var button = document.createElement("button");
    var letter = document.createElement("span");
    var text = document.createElement("span");
    var mark = document.createElement("span");

    button.type = "button";
    button.className = "quiz-answer";
    button.dataset.answer = String(index);
    button.setAttribute("aria-label", letters[index] + ". " + option);
    letter.className = "answer-letter";
    letter.textContent = letters[index];
    text.className = "answer-text";
    text.textContent = option;
    mark.className = "answer-mark";
    mark.setAttribute("aria-hidden", "true");
    button.appendChild(letter);
    button.appendChild(text);
    button.appendChild(mark);
    button.addEventListener("click", function () { chooseAnswer(index); });
    return button;
  }

  function renderQuestion(shouldFocus) {
    var question = Core.currentQuestion(state);
    var total = state.questions.length;
    var position = state.index + 1;
    var percentage = Math.round((position / total) * 100);

    setText(ui.position, "Question " + position + " of " + total);
    setText(ui.category, question.category);
    setText(ui.percent, percentage + "%");
    ui.progress.style.width = percentage + "%";
    setText(ui.question, question.question);
    ui.answers.replaceChildren();
    question.options.forEach(function (option, index) {
      ui.answers.appendChild(makeAnswerButton(option, index));
    });

    ui.feedback.hidden = true;
    ui.nextRow.hidden = true;
    ui.questionPanel.hidden = false;
    ui.result.hidden = true;
    setText(ui.nextLabel, position === total ? "See results" : "Next question");
    updateStats();
    if (shouldFocus) {
      ui.question.focus({ preventScroll: true });
    }
  }

  function chooseAnswer(index) {
    var outcome = Core.submitAnswer(state, index);
    if (!outcome) {
      return;
    }

    var buttons = Array.prototype.slice.call(ui.answers.querySelectorAll(".quiz-answer"));
    buttons.forEach(function (button, buttonIndex) {
      button.disabled = true;
      if (buttonIndex === outcome.answer) {
        button.classList.add("correct");
        button.querySelector(".answer-mark").textContent = "✓";
      } else if (buttonIndex === outcome.selected) {
        button.classList.add("wrong");
        button.querySelector(".answer-mark").textContent = "×";
      }
    });

    setText(ui.feedbackTitle, outcome.correct ? "Correct!" : "Not quite");
    setText(ui.explanation, outcome.question.explanation);
    ui.source.href = outcome.question.source.url;
    setText(ui.sourceLabel, outcome.question.source.label || "Official source");
    ui.feedback.hidden = false;
    ui.nextRow.hidden = false;
    updateStats();
    announce((outcome.correct ? "Correct. " : "Incorrect. ") + outcome.question.explanation);
    ui.next.focus({ preventScroll: true });
  }

  function finishQuiz() {
    var result = Core.resultFor(state.score, state.questions.length);
    bestScore = Math.max(bestScore, state.score);
    saveBest();
    updateStats();
    ui.questionPanel.hidden = true;
    ui.result.hidden = false;
    setText(ui.finalScore, state.score);
    setText(ui.resultTitle, result.title);
    setText(ui.resultMessage, result.message + " You scored " + result.percentage + "%.");
    announce("Quiz complete. " + state.score + " out of " + state.questions.length + ". " + result.title + ".");
    ui.restart.focus({ preventScroll: true });
  }

  function goNext() {
    if (!state.answered) {
      return;
    }
    Core.nextQuestion(state);
    if (state.completed) {
      finishQuiz();
    } else {
      renderQuestion(true);
    }
  }

  function restartQuiz() {
    state = Core.createQuiz(questions);
    renderQuestion(true);
    announce("Quiz restarted. Question 1 of " + state.questions.length + ".");
  }

  function showDataError() {
    setText(ui.question, "Quiz unavailable");
    ui.answers.replaceChildren();
    ui.feedback.hidden = false;
    setText(ui.feedbackTitle, "The question set could not be loaded.");
    setText(ui.explanation, "Please refresh the page and try again.");
    ui.source.hidden = true;
    ui.nextRow.hidden = true;
    root.dataset.quizStatus = "error";
  }

  ui.next.addEventListener("click", goNext);
  ui.restart.addEventListener("click", restartQuiz);
  root.addEventListener("keydown", function (event) {
    if (!state || state.completed) {
      return;
    }
    var keyMap = { "1": 0, "2": 1, "3": 2, "4": 3, a: 0, b: 1, c: 2, d: 3 };
    var key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (!state.answered && Object.prototype.hasOwnProperty.call(keyMap, key)) {
      event.preventDefault();
      chooseAnswer(keyMap[key]);
    } else if (state.answered && event.key === "Enter") {
      event.preventDefault();
      goNext();
    }
  });

  try {
    questions = JSON.parse(dataNode.textContent);
    state = Core.createQuiz(questions);
    renderQuestion(false);
  } catch (error) {
    showDataError();
  }
})();
