const test = require("node:test");
const assert = require("node:assert/strict");
const Sync = require("../sync-core.js");
const term = meaning => ({ word: "course", meaning });
const snapshot = (revision, meaning) => ({ version: 2, revision, items: [{ word: "course", revision, value: term(meaning) }] });
const initialized = () => Sync.download(Sync.initial(), snapshot(1, "강의"));

test("first synchronization is mandatory and invalid downloads never initialize", () => {
  const state = Sync.initial();
  assert.equal(state.autoUpload, true);
  Sync.edit(state, "new", { word: "new" });
  assert.equal(Sync.effective(state)[0].word, 'new');
  assert.throws(() => Sync.download(state, { version: 2, revision: 2, items: [{ word: "course", revision: 3, value: term("과정") }] }), /INVALID_DICTIONARY/);
  assert.equal(state.initialized, false);
});

test("local edits survive a restart and downloads preserve their original conflict baseline", () => {
  const state = initialized();
  Sync.edit(state, "course", term("과정"));
  const restarted = JSON.parse(JSON.stringify(state));
  Sync.download(restarted, snapshot(2, "강좌"));
  assert.equal(Sync.effective(restarted)[0].meaning, "과정");
  assert.equal(restarted.drafts[0].baseRevision, 1);
  const before = JSON.stringify(restarted);
  assert.throws(() => Sync.download(restarted, snapshot(1, "과거")), /OLDER_SERVER_DICTIONARY/);
  assert.equal(JSON.stringify(restarted), before);
});

test("conflicts pause one term and keep local prevents automatic resubmission", () => {
  const state = initialized();
  Sync.edit(state, "course", term("과정"));
  Sync.edit(state, "other", { word: "other" });
  const sent = Sync.clone(state.drafts[0]);
  const server = { word: "course", revision: 2, value: term("강좌") };
  Sync.accept(state, sent, { status: "conflict", item: server, conflict: { id: 7, word: "course", server, proposed: sent.value } }, "owner");
  assert.equal(state.drafts[0].mode, "conflict");
  assert.equal(state.drafts[1].mode, "pending");
  state.drafts[0].resolution = { choice: "local" };
  Sync.resolved(state, Sync.clone(state.drafts[0]), { status: "resolved", item: server, choice: "local" });
  assert.equal(state.drafts[0].mode, "local");
  assert.equal(state.drafts[0].conflict, undefined);
  Sync.download(state, snapshot(3, "수업"));
  assert.equal(Sync.effective(state).find(row => row.word === "course").meaning, "과정");
});

test("an acknowledgement cannot erase a newer edit made during the request", () => {
  const state = initialized();
  Sync.edit(state, "course", term("과정"));
  const sent = Sync.clone(state.drafts[0]);
  Sync.edit(state, "course", term("수업"));
  Sync.accept(state, sent, { status: "saved", item: { word: "course", revision: 2, value: sent.value } }, "owner");
  assert.equal(Sync.effective(state)[0].meaning, "수업");
  assert.equal(state.drafts[0].baseRevision, 2);
  assert.notEqual(state.drafts[0].requestId, sent.requestId);
});

test("later remains paused without a permanently queued resolution request", () => {
  const state = initialized();
  Sync.edit(state, "course", term("과정"));
  const draft = state.drafts[0];
  draft.conflict = { ownerId: "owner" };
  draft.mode = "conflict";
  draft.resolution = { choice: "later" };
  Sync.resolved(state, Sync.clone(draft), { status: "resolved", choice: "later", item: Sync.item(state, "course") });
  assert.equal(draft.mode, "conflict");
  assert.equal(draft.resolution, undefined);
});

test("use server removes the local overlay and deleted terms remain absent", () => {
  const state = initialized();
  Sync.edit(state, "course", null);
  assert.deepEqual(Sync.effective(state), []);
  const draft = state.drafts[0];
  draft.conflict = { ownerId: "owner" };
  Sync.resolved(state, Sync.clone(draft), { status: "resolved", choice: "server", item: { word: "course", revision: 2, value: term("강좌") } });
  assert.equal(state.drafts.length, 0);
  assert.equal(Sync.effective(state)[0].meaning, "강좌");
});

test("request retries preserve IDs and word identity safely includes prototype names and case variants", () => {
  const state = initialized();
  for (const word of ["SAM", "sam", "__proto__"]) Sync.edit(state, word, { word });
  const restarted = Sync.clone(state);
  assert.deepEqual(Sync.request(state.drafts[0]), Sync.request(restarted.drafts[0]));
  assert.equal(Sync.effective(state).length, 4);
  assert.throws(() => Sync.edit(state, "bad", { word: "bad", executable: "code" }), /INVALID_TERM/);
});
