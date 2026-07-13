const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const quizPath = path.join(__dirname, "..", "data", "quiz.yaml");
const quizData = fs.readFileSync(quizPath, "utf8").trim();
const questionBlocks = quizData.split(/\r?\n(?=- id: )/);

test("quiz contains at least 20 questions", () => {
  assert.ok(questionBlocks.length >= 20);
});

test("every quiz question has the required data", () => {
  const ids = new Set();

  questionBlocks.forEach((block, index) => {
    const id = block.match(/^- id: ([^\r\n]+)/)?.[1];
    const options = block.match(/  options:\r?\n([\s\S]*?)\r?\n  answer:/)?.[1];
    const answer = Number(block.match(/  answer: (\d+)/)?.[1]);

    assert.ok(id, `question ${index + 1} needs an id`);
    assert.equal(ids.has(id), false, `duplicate id: ${id}`);
    ids.add(id);

    assert.match(block, /  category: .+/);
    assert.match(block, /  question: .+/);
    assert.equal(options?.match(/^    - /gm)?.length, 4, `${id} needs four options`);
    assert.ok(Number.isInteger(answer) && answer >= 0 && answer <= 3, `${id} has an invalid answer`);
    assert.match(block, /  explanation: .+/);
    assert.match(block, /    label: .+/);
    assert.match(block, /    url: "https:\/\/.+"/);
  });
});
