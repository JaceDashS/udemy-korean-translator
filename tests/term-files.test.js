const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const termFiles = require("../editor/term-files.js");
const SCRIPT = path.join(__dirname, "..", "tools", "build-dictionary.js");

test("file names are stable, readable, and differ by case", async () => {
  const name = await termFiles.fileName("IAM role");
  assert.match(name, /^terms\/iam-role-[0-9a-f]{8}\.json$/);
  assert.equal(await termFiles.fileName("IAM role"), name);
  assert.notEqual(await termFiles.fileName("SAM"), await termFiles.fileName("sam"));
  assert.match(await termFiles.fileName("/compact"), /^terms\/compact-[0-9a-f]{8}\.json$/);
  assert.match(await termFiles.fileName("한국어"), /^terms\/term-[0-9a-f]{8}\.json$/);
});

test("file content has a fixed key order and drops empty fields", () => {
  assert.equal(
    termFiles.fileContent({ exact: true, meaning: " 역할 ", word: " IAM role " }),
    '{\n  "word": "IAM role",\n  "meaning": "역할",\n  "exact": true\n}\n'
  );
  assert.equal(termFiles.fileContent({ word: "EC2", meaning: "", exact: false }), '{\n  "word": "EC2"\n}\n');
});

test("blobSha matches git's blob id", async () => {
  const text = termFiles.fileContent({ word: "agent", meaning: "에이전트" });
  const bytes = Buffer.from(text, "utf8");
  const expected = crypto.createHash("sha1")
    .update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]))
    .digest("hex");
  assert.equal(await termFiles.blobSha(text), expected);
});

test("checkTerm rejects malformed terms", () => {
  assert.equal(termFiles.checkTerm({ word: "EC2" }), null);
  assert.ok(termFiles.checkTerm({ word: " " }));
  assert.ok(termFiles.checkTerm({ word: "EC2", exact: false }));
  assert.ok(termFiles.checkTerm({ word: "EC2", extra: 1 }));
  assert.ok(termFiles.checkTerm({ word: "EC2", meaning: 3 }));
});

test("split then build gives back the same dictionary.json", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "terms-"));
  const original = termFiles.buildDictionary([
    { word: "SAM" }, { word: "sam", meaning: "샘" }, { word: "IAM role", exact: true }
  ]);
  fs.writeFileSync(path.join(dir, "in.json"), original);
  execFileSync("node", [SCRIPT, "split", path.join(dir, "in.json"), path.join(dir, "terms")]);
  execFileSync("node", [SCRIPT, "build", path.join(dir, "terms"), path.join(dir, "out.json")]);
  assert.equal(fs.readFileSync(path.join(dir, "out.json"), "utf8"), original);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("build rejects a file stored under the wrong name", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "terms-"));
  fs.mkdirSync(path.join(dir, "terms"));
  fs.writeFileSync(path.join(dir, "terms", "wrong.json"), termFiles.fileContent({ word: "EC2" }));
  assert.throws(
    () => execFileSync("node", [SCRIPT, "build", path.join(dir, "terms"), path.join(dir, "out.json")], { stdio: "pipe" }),
    /must be named/
  );
  fs.rmSync(dir, { recursive: true, force: true });
});
