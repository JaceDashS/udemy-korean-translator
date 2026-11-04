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
  assert.deepEqual(protect("Use AWS Lambda function URLs.").terms, ["AWS Lambda function"]);
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
  assert.deepEqual(protect(source), { text: source, terms: [] });
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
