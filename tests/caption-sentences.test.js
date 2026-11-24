const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
require("../sentences.js");
const { transcriptSentences, liveSentences } = globalThis.__udemyCaptionSentences;

test("automatic captions accept Japanese punctuation and bound incomplete live text at cue boundaries", () => {
  const captions = liveSentences("ja");
  assert.deepEqual(captions(["今日は"]), []);
  assert.deepEqual(captions(["日本語を勉強します。"]), ["今日は 日本語を勉強します。"]);
  const longCue = "あ".repeat(31);
  assert.deepEqual(captions([longCue]), []);
  assert.deepEqual(captions(["い".repeat(30)]), [longCue + " " + "い".repeat(30)]);
  assert.equal(transcriptSentences(["これは", "句読点のない字幕"], "ja").sentences[0].text, "これは 句読点のない字幕");
});

test("a transcript displays the complete sentence from the first through the last cue", () => {
  const transcript = transcriptSentences(["When you open", "the settings menu", "choose English.", "Now continue."]);
  assert.deepEqual(transcript.sentences, [
    { text: "When you open the settings menu choose English.", last: 2 },
    { text: "Now continue.", last: 3 },
  ]);
  let previous = -1;
  for (const fragment of ["When you\nopen", "the settings menu", "choose English."]) {
    previous = transcript.locate(fragment, previous);
    assert.deepEqual(transcript.byCue[previous], [0]);
  }
  assert.deepEqual(transcript.byCue[transcript.locate("Now continue.", previous)], [1]);
});

test("the overlay can recover its sentence from the middle without guessing duplicate cues", () => {
  const transcript = transcriptSentences(["Good.", "Dr. Kim is here.", "Good.", "Thank you."]);
  assert.equal(transcript.locate("Good.", -1), -1);
  assert.deepEqual(transcript.byCue[transcript.locate("Dr. Kim is here.", -1)], [1]);
  assert.equal(transcript.locate("Good.", 1), 2);
  assert.equal(transcript.locate("Missing cue", 2), -1);
});

test("the caption controller keeps the complete translation through the last transcript fragment", async () => {
  const rect = { left: 0, top: 0, right: 800, bottom: 450, width: 800, height: 450 };
  const languagesStarted = [];
  const element = () => ({
    style: {}, classList: { toggle() {}, remove() {} },
    getBoundingClientRect: () => rect,
    listeners: {}, addEventListener(name, callback) { this.listeners[name] = callback; },
    setAttribute(name, value) { this[name] = value; },
    showModal() { this.open = true; },
    close() { this.open = false; },
    remove() {},
    removeEventListener() {}, append(...children) {
      for (const child of children) if (typeof child === "object") child.parentElement = this;
    },
  });
  const video = { ...element(), textTracks: [], currentTime: 0 };
  const cue = { ...element(), textContent: "" };
  const panel = { querySelectorAll: () => ["When you open", "the settings menu", "choose English.", "Now continue."].map(textContent => ({ textContent })) };
  let tick;
  const created = [];
  const document = {
    head: element(), body: element(), documentElement: element(),
    createElement(tag) {
      const node = element();
      node.tag = tag;
      created.push(node);
      return node;
    },
    addEventListener() {},
    querySelector: () => panel,
    querySelectorAll: selector => selector === "video" ? [video] : [cue],
  };
  const core = {
    async translate(text) { return "Translated: " + text; },
    async startCaption(language) {
      languagesStarted.push(language);
      return { async translate(text) { return language + ": " + text; } };
    },
    dictionaryVersion: () => 1, onReady: ready => ready(),
  };
  const ctx = vm.createContext({ document, __udemyKoreanTranslator: core,
    __udemyCaptionSentences: globalThis.__udemyCaptionSentences, location: { pathname: "/lecture" },
    localStorage: { getItem: () => null }, innerWidth: 900, innerHeight: 700, console, performance,
    MutationObserver: class { observe() {} disconnect() {} }, setInterval: callback => { tick = callback; } });
  ctx.window = ctx;
  vm.runInContext(fs.readFileSync(require.resolve("../caption.js"), "utf8"), ctx);
  const overlay = created.find(node => node.id === "udemy-ko-caption-overlay");
  const settle = () => new Promise(resolve => setImmediate(resolve));
  await settle();
  tick();
  await settle();
  const diagnosticButton = created.find(node => node.textContent === "자막 진단 시작");
  diagnosticButton.listeners.click();
  for (const fragment of ["When you open", "", "the settings menu", "choose English."]) {
    cue.textContent = fragment;
    tick();
    assert.equal(overlay.textContent, "Translated: When you open the settings menu choose English.");
  }
  cue.textContent = "";
  tick();
  assert.equal(overlay.textContent, "");
  cue.textContent = "Now continue.";
  tick();
  assert.equal(overlay.textContent, "Translated: Now continue.");
  const dialog = created.find(node => node.tag === "dialog");
  assert.equal(dialog.open, undefined);
  diagnosticButton.listeners.click();
  assert.equal(dialog.open, true);
  const exported = created.find(node => node.tag === "textarea").value;
  assert.equal(exported.includes("When you open"), false);
  const events = JSON.parse(exported).events.filter(event => event.cues.length);
  assert.deepEqual(events.map(event => event.transcriptRow), [1, 2, 3, 4]);
  assert.ok(events.slice(0, 3).every(event => event.displayed[0] === events[0].displayed[0]));
  const picker = created.find(node => node.tag === "select");
  cue.textContent = "日本語の字幕です。";
  tick();
  await settle();
  tick();
  assert.deepEqual(languagesStarted, ["ja"]);
  assert.equal(overlay.textContent, "ja: 日本語の字幕です。");
  picker.value = "es";
  cue.textContent = "Esta es una prueba.";
  picker.listeners.change();
  await settle();
  tick();
  assert.deepEqual(languagesStarted, ["ja", "es"]);
  assert.equal(overlay.textContent, "es: Esta es una prueba.");
});
