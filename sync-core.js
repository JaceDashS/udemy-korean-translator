/* Persistent dictionary state. This module never receives account credentials. */
(() => {
  "use strict";
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const clone = value => JSON.parse(JSON.stringify(value));
  const id = () => globalThis.crypto.randomUUID();

  function normalizeTerm(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || typeof raw.word !== "string" ||
      !raw.word.trim() || raw.word.length > 200 || Object.keys(raw).some(key => !["word", "meaning", "exact"].includes(key)) ||
      (raw.meaning !== undefined && (typeof raw.meaning !== "string" || raw.meaning.length > 200)) ||
      (raw.exact !== undefined && typeof raw.exact !== "boolean")) throw new Error("INVALID_TERM");
    const term = { word: raw.word.trim() };
    if (raw.meaning?.trim()) term.meaning = raw.meaning.trim();
    if (raw.exact === true) term.exact = true;
    return term;
  }

  function initial() {
    return { schema: 1, initialized: false, revision: 0, items: [], drafts: [], downloadedAt: null };
  }

  function validateSnapshot(raw) {
    if (raw?.version !== 2 || !Number.isSafeInteger(raw.revision) || raw.revision < 0 || !Array.isArray(raw.items)) throw new Error("INVALID_DICTIONARY");
    const seen = new Set();
    const items = raw.items.map(row => {
      const word = normalizeTerm({ word: row?.word }).word;
      if (seen.has(word) || !Number.isSafeInteger(row.revision) || row.revision < 1 || row.revision > raw.revision) throw new Error("INVALID_DICTIONARY");
      seen.add(word);
      const value = row.value === null ? null : normalizeTerm(row.value);
      if (value && value.word !== word) throw new Error("INVALID_DICTIONARY");
      return { word, revision: row.revision, value };
    });
    if (items.filter(item => item.value).length > 10000) throw new Error("INVALID_DICTIONARY");
    return { revision: raw.revision, items };
  }

  function download(state, raw, now = new Date().toISOString()) {
    const snapshot = validateSnapshot(raw);
    if (state.initialized && snapshot.revision < state.revision) throw new Error("OLDER_SERVER_DICTIONARY");
    const items = new Map(snapshot.items.map(entry => [entry.word, entry]));
    for (const entry of state.items) {
      if (entry.revision > snapshot.revision) items.set(entry.word, entry);
    }
    state.items = [...items.values()];
    state.revision = snapshot.revision;
    state.initialized = true;
    state.downloadedAt = now;
    // Draft baselines remain unchanged: a download is not an upload approval.
    return state;
  }

  function item(state, word) {
    return state.items.find(entry => entry.word === word) || { word, revision: 0, value: null };
  }

  function effective(state) {
    const terms = new Map(state.items.map(entry => [entry.word, entry.value]));
    for (const draft of state.drafts) terms.set(draft.word, draft.value);
    return [...terms.values()].filter(Boolean);
  }

  function edit(state, word, raw) {
    word = normalizeTerm({ word }).word;
    const value = raw === null ? null : normalizeTerm(raw);
    if (value && value.word !== word) throw new Error("WORD_MISMATCH");
    const previous = state.drafts.find(draft => draft.word === word);
    if (previous?.conflict) throw new Error("RESOLVE_CONFLICT_BEFORE_EDITING");
    if (same(previous?.value, value)) return;
    if (value && !effective(state).some(term => term.word === word) && effective(state).length >= 10000) throw new Error("DICTIONARY_FULL");
    const baseline = item(state, word);
    state.drafts = state.drafts.filter(draft => draft.word !== word);
    if (!previous && same(baseline.value, value)) return;
    state.drafts.push({ word, value, baseRevision: previous?.baseRevision ?? baseline.revision,
      localRevision: id(), requestId: id(), mode: "pending" });
  }

  function request(draft) {
    return { word: draft.word, value: clone(draft.value), baseRevision: draft.baseRevision, requestId: draft.requestId };
  }

  function updateItem(state, incoming) {
    const position = state.items.findIndex(entry => entry.word === incoming.word);
    const current = item(state, incoming.word);
    if (!Number.isSafeInteger(incoming.revision) || incoming.revision < current.revision || incoming.revision === 0) return;
    if (position < 0) state.items.push(incoming); else state.items[position] = incoming;
  }

  function syncConflict(state, word, conflictId, incoming) {
    if (incoming?.word !== word || !Number.isSafeInteger(incoming.revision) || incoming.revision < 0 ||
        (incoming.value !== null && normalizeTerm(incoming.value).word !== word)) throw new Error("INVALID_DICTIONARY");
    updateItem(state, incoming);
    const draft = state.drafts.find(entry => entry.word === word && entry.conflict?.id === conflictId);
    if (draft) {
      const latest = item(state, word);
      draft.conflict.server = latest.revision === draft.conflict.server.revision ? draft.conflict.server : latest;
      draft.conflict.synced = true;
    }
  }

  function selectedDrafts(state, selections) {
    const byWord = new Map(selections.map(({ word, localRevision }) => [word, localRevision]));
    return state.drafts.filter(draft => draft.mode === "pending" && byWord.get(draft.word) === draft.localRevision);
  }

  function accept(state, sent, answer, ownerId) {
    updateItem(state, answer.item);
    const draft = state.drafts.find(entry => entry.word === sent.word);
    if (!draft) return;
    if (answer.status === "conflict") {
      if (draft.localRevision !== sent.localRevision) return;
      draft.mode = "conflict";
      draft.conflict = { ...answer.conflict, ownerId };
      delete draft.resolution;
    } else if (draft.localRevision === sent.localRevision) {
      state.drafts = state.drafts.filter(entry => entry !== draft);
    } else {
      // A later edit made while a request was in flight is still pending.
      draft.baseRevision = answer.item.revision;
      draft.requestId = id();
    }
  }

  function resolved(state, sent, answer) {
    const draft = state.drafts.find(entry => entry.word === sent.word);
    if (!draft || draft.localRevision !== sent.localRevision) return;
    if (answer.status === "conflict") return accept(state, sent, answer, sent.conflict.ownerId);
    if (answer.choice === "later") { delete draft.resolution; return; }
    if (answer.choice === "local" || answer.choice === "review" ||
        (answer.choice === "server" && sent.resolution?.choice === "review")) {
      updateItem(state, answer.item);
      draft.mode = "local";
      if (answer.choice === "review") draft.reviewRequested = true;
      delete draft.conflict;
      delete draft.resolution;
      return;
    }
    accept(state, sent, answer, sent.conflict.ownerId);
  }

  const api = { initial, normalizeTerm, validateSnapshot, download, item, effective, edit, request, accept, resolved, syncConflict, selectedDrafts, clone };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.DictionarySync = api;
})();
