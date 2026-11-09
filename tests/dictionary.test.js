const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

globalThis.window = globalThis;
require(path.join(__dirname, "..", "dictionary-terms.js"));
require(path.join(__dirname, "..", "dictionary.js"));
const { protect, restore } = window.__udemyQuizTranslatorDictionary;

test("replaces terms with placeholders and restores the original text", () => {
  const source = "Launch an EC2 instance in a private subnet with an IAM role.";
  const { text, terms } = protect(source);

  assert.equal(text, "Launch an [[0]] [[1]] in a [[2]] with an [[3]].");
  assert.deepEqual(terms, ["EC2", "instance", "private subnet", "IAM role"]);

  const translated = "[[2]]에서 [[0]] [[1]]를 [[3]]과 함께 시작합니다.";
  assert.equal(
    restore(translated, terms),
    "private subnet에서 EC2 instance를 IAM role과 함께 시작합니다."
  );
});

test("prefers the longest matching term", () => {
  assert.deepEqual(protect("Use AWS Lambda function URLs.").terms, ["AWS Lambda function", "URLs"]);
  assert.deepEqual(protect("Use AWS Lambda with an IAM role.").terms, ["AWS Lambda", "IAM role"]);
});

test("keeps plural and original casing", () => {
  const { terms } = protect("Two Security Groups and three VPCs.");
  assert.deepEqual(terms, ["Security Groups", "VPCs"]);
});

test("acronyms match case-sensitively", () => {
  const { terms } = protect("Sam noticed lag after deploying with SAM.");
  assert.deepEqual(terms, ["SAM"]);
});

test("case-sensitive names ignore lowercase words", () => {
  assert.deepEqual(protect("I wrote a haiku about my projects.").terms, []);
  assert.deepEqual(protect("Claude Haiku in Projects").terms, ["Claude", "Haiku", "Projects"]);
});

test("does not match inside other words", () => {
  assert.deepEqual(protect("The subnetwork is ok.").terms, []);
  assert.deepEqual(protect("Use SQSX now.").terms, []);
});

test("matches terms across line breaks and extra spaces", () => {
  const { terms } = protect("Configure a  private\nsubnet.");
  assert.deepEqual(terms, ["private\nsubnet"]);
});

test("leaves text with existing placeholder syntax untouched", () => {
  const source = "Value [[0]] with an EC2 instance";
  assert.equal(protect(source).text, source);
  assert.deepEqual(protect(source).terms, []);
});

test("restore returns null when a placeholder is lost", () => {
  assert.equal(restore("[[0]]만 남음", ["EC2", "S3"]), null);
});

test("restore accepts spacing inside brackets and repeated placeholders", () => {
  assert.equal(restore("[[ 0 ]]와 [[0]]", ["S3"]), "S3와 S3");
});

test("restore returns text unchanged when there are no terms", () => {
  assert.equal(restore("번역", []), "번역");
});

test("restore absorbs extra brackets added by the translator", () => {
  assert.equal(restore("[[[0]]에서 [[1]]]", ["Auto Scaling group", "EC2"]), "Auto Scaling group에서 EC2");
});

test("keeps CCAR-F exam terms in English", () => {
  const source = "Claude Code must block any Bash command during an agentic session. " +
    "The enforcement must be deterministic; CLAUDE.md is applied deterministically at every session.";
  assert.deepEqual(protect(source).terms, [
    "Claude Code", "Bash command", "agentic session", "deterministic",
    "CLAUDE.md", "deterministically", "session"
  ]);
});

test("ordinary English verbs and nouns are still translated", () => {
  assert.deepEqual(protect("Read the file and continue with the next step. Pay attention to the summary.").terms, []);
});

test("pairs are replaced with their meaning", () => {
  const { configure } = window.__udemyQuizTranslatorDictionary;
  configure({ "private subnet": "프라이빗 서브넷", lag: "지연" });
  try {
    const { text, terms, meanings } = protect("Create a private subnet with lag.");
    assert.equal(text, "Create a [[0]] with [[1]].");
    assert.deepEqual(terms, ["private subnet", "lag"]);
    assert.deepEqual(meanings, ["프라이빗 서브넷", "지연"]);
    assert.equal(
      restore("[[0]]을 생성하고 [[1]]을 확인합니다.", terms, meanings),
      "프라이빗 서브넷을 생성하고 지연을 확인합니다."
    );
  } finally {
    configure({});
  }
});

test("pair lookup accepts a plural of the listed word", () => {
  const { configure } = window.__udemyQuizTranslatorDictionary;
  configure({ "private subnet": "프라이빗 서브넷" });
  try {
    assert.deepEqual(protect("Two private subnets.").meanings, ["프라이빗 서브넷"]);
  } finally {
    configure({});
  }
});

test("a pair overrides a kept term with the same spelling", () => {
  const { configure } = window.__udemyQuizTranslatorDictionary;
  configure({ "Private Subnet": "프라이빗 서브넷" });
  try {
    const { terms, meanings } = protect("a private subnet");
    assert.deepEqual(terms, ["private subnet"]);
    assert.deepEqual(meanings, ["프라이빗 서브넷"]);
  } finally {
    configure({});
  }
});

test("kept terms have no meaning and restore to English", () => {
  const { meanings } = protect("Launch an EC2 instance.");
  assert.deepEqual(meanings, [undefined, undefined]);
  assert.equal(restore("[[0]] [[1]]", ["EC2", "instance"], meanings), "EC2 instance");
});

test("acronym pairs match case-sensitively", () => {
  const { configure } = window.__udemyQuizTranslatorDictionary;
  configure({ SAM: "서버리스 애플리케이션 모델" });
  try {
    assert.deepEqual(protect("Sam and SAM.").terms, ["SAM"]);
  } finally {
    configure({});
  }
});
