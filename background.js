/* Account operations stay in this service worker and trusted extension pages. */
importScripts("sync-core.js");
const Sync = globalThis.DictionarySync;
const API = "https://api.jace-s.com/udemy-translator";
let state;
let stateQueue = Promise.resolve();
let downloading;
let uploading;
let lastCheck = 0;
let authorizationCheck;

const boot = (async () => {
  await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  await chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  const saved = (await chrome.storage.local.get("dictionaryState")).dictionaryState;
  if (saved && (saved.schema !== 1 || !Array.isArray(saved.items) || !Array.isArray(saved.drafts))) throw new Error("INVALID_LOCAL_STATE");
  state = saved || Sync.initial();
})();

function mutate(change) {
  const run = stateQueue.then(async () => {
    await boot;
    const next = Sync.clone(state);
    const result = change(next);
    await chrome.storage.local.set({ dictionaryState: next });
    state = next;
    const count = state.drafts.filter(draft => draft.mode === "conflict").length;
    await chrome.action.setBadgeText({ text: count ? String(count) : "" });
    await chrome.action.setBadgeBackgroundColor({ color: "#b7791f" });
    void notifyTabs().catch(() => {});
    return result;
  });
  stateQueue = run.catch(() => {});
  return run;
}

async function notifyTabs() {
  const tabs = await chrome.tabs.query({ url: ["https://www.udemy.com/*", "https://udemy.com/*"] });
  await Promise.allSettled(tabs.map(tab => chrome.tabs.sendMessage(tab.id, { target: "dictionary-updated" })));
}

async function readState() {
  await boot;
  await stateQueue;
  return Sync.clone(state);
}

async function auth() {
  return (await chrome.storage.session.get("translatorAuth")).translatorAuth || null;
}

async function call(path, body, credentials) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const headers = { "Content-Type": "application/json" };
    if (credentials) {
      headers.Authorization = `Bearer ${credentials.token}`;
      headers["X-CSRF-Token"] = credentials.csrfToken;
    }
    const response = await fetch(API + path, { method: body === undefined ? "GET" : "POST", credentials: "omit",
      cache: "no-store", headers, signal: controller.signal, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json();
    if (response.status === 401 && credentials) await chrome.storage.session.remove("translatorAuth");
    if (!response.ok && !(response.status === 409 && data.status === "conflict")) throw new Error(data.error || `HTTP_${response.status}`);
    return data;
  } finally { clearTimeout(timer); }
}

async function download(force = false) {
  if (downloading) return downloading;
  if (!force && Date.now() - lastCheck < 5000) return;
  lastCheck = Date.now();
  downloading = (async () => {
    const snapshot = await call("/dictionary");
    await mutate(next => Sync.download(next, snapshot));
  })();
  try { await downloading; } finally { downloading = null; }
}

async function uploadOne(draft, credentials) {
  const result = await call("/upload", Sync.request(draft), credentials);
  await mutate(next => Sync.accept(next, draft, result, credentials.user.id));
  if (result.status === "conflict") {
    try { await fetchConflict(draft.word, result.conflict.id); } catch { /* The editor offers a retry. */ }
  }
  return result.status;
}

async function fetchConflict(word, id) {
  const latest = await call(`/dictionary/item?${new URLSearchParams({ word })}`);
  await mutate(next => Sync.syncConflict(next, word, id, latest));
}

async function verifiedCredentials() {
  const credentials = await auth();
  if (!credentials) return null;
  const session = await call("/session", undefined, credentials);
  if ((await auth())?.token !== credentials.token) return null;
  if (credentials.canUpload !== session.canUpload) {
    credentials.canUpload = session.canUpload;
    await chrome.storage.session.set({ translatorAuth: credentials });
  }
  return credentials;
}

async function authorizedUpload() {
  const credentials = await verifiedCredentials();
  if (!credentials) throw new Error("UNAUTHENTICATED");
  if (!credentials.canUpload) throw new Error("FORBIDDEN");
  return credentials;
}

async function upload(selections) {
  if (!Array.isArray(selections) || selections.length > 10000 || selections.some(selection =>
    typeof selection?.word !== "string" || typeof selection?.localRevision !== "string")) throw new Error("INVALID_SELECTION");
  if (uploading) throw new Error("UPLOAD_IN_PROGRESS");
  uploading = true;
  try {
    const credentials = await authorizedUpload();
    const counts = { published: 0, conflicts: 0, skipped: 0 };
    for (const selection of selections) {
      if ((await auth())?.token !== credentials.token) throw new Error("UNAUTHENTICATED");
      const [draft] = Sync.selectedDrafts(await readState(), [selection]);
      if (!draft) { counts.skipped++; continue; }
      if (await uploadOne(draft, credentials) === "conflict") counts.conflicts++;
      else counts.published++;
    }
    return counts;
  } finally { uploading = false; }
}

async function view() {
  const current = await readState();
  const credentials = await auth();
  const pending = (await chrome.storage.session.get('translatorConnection')).translatorConnection;
  return { state: current, terms: Sync.effective(current), user: credentials?.user || null, canUpload: credentials?.canUpload === true,
    loginPending: !!pending && pending.expiresAt > Date.now() };
}

async function login() {
  const challenge = crypto.randomUUID();
  const pending = { challenge, expiresAt: Date.now() + 10 * 60 * 1000 };
  await chrome.storage.session.set({ translatorConnection: pending });
  const query = new URLSearchParams({ extensionId: chrome.runtime.id, challenge });
  const tab = await chrome.tabs.create({ url: `https://jace-s.com/translator-connect?${query}` });
  const latest = (await chrome.storage.session.get('translatorConnection')).translatorConnection;
  if (latest?.challenge === challenge) await chrome.storage.session.set({ translatorConnection: { ...pending, tabId: tab.id } });
  return view();
}

async function finishConnection(message, sender) {
  const source = new URL(sender.url || 'https://invalid.invalid/');
  if (!['https://jace-s.com', 'https://www.jace-s.com'].includes(source.origin) || source.pathname !== '/translator-connect') throw new Error('FORBIDDEN');
  const pending = (await chrome.storage.session.get('translatorConnection')).translatorConnection;
  if (!pending || pending.expiresAt <= Date.now() || message.challenge !== pending.challenge || (pending.tabId !== undefined && sender.tab?.id !== pending.tabId)) throw new Error('INVALID_CONNECTION');
  const credentials = message.credentials;
  if (!credentials || !/^[A-Za-z0-9_-]{43}$/.test(credentials.token) || !/^[A-Za-z0-9_-]{43}$/.test(credentials.csrfToken)) throw new Error('INVALID_CONNECTION');
  const verified = await call('/session', undefined, credentials);
  await chrome.storage.session.set({ translatorAuth: { ...credentials, ...verified } });
  await chrome.storage.session.remove('translatorConnection');
  return pending.tabId;
}

chrome.runtime.onMessageExternal.addListener((message, sender, respond) => {
  if (message?.target !== 'translator-connect') return false;
  finishConnection(message, sender).then(tabId => {
    respond({ ok: true });
    if (tabId !== undefined) void chrome.tabs.remove(tabId).catch(() => {});
  }, error => respond({ ok: false, error: error.message || 'CONNECTION_FAILED' }));
  return true;
});

async function resolve(message) {
  const credentials = await authorizedUpload();
  const sent = await mutate(next => {
    const draft = next.drafts.find(row => row.word === message.word && row.conflict?.id === message.conflictId);
    if (!draft || draft.conflict.ownerId !== credentials.user.id) throw new Error("CONFLICT_NOT_FOUND");
    if (!["review", "local"].includes(message.choice)) throw new Error("INVALID_RESOLUTION");
    if (message.choice === "review" && !draft.conflict.synced) throw new Error("FETCH_LATEST_FIRST");
    if (draft.resolution?.choice === message.choice && draft.resolution.baseRevision === draft.conflict.server.revision) return draft;
    draft.resolution = { choice: message.choice, baseRevision: draft.conflict.server.revision, requestId: crypto.randomUUID() };
    return draft;
  });
  const result = await call(`/conflicts/${sent.conflict.id}/resolve`, sent.resolution, credentials);
  await mutate(next => Sync.resolved(next, sent, result));
  if (result.status === "conflict") {
    try { await fetchConflict(sent.word, result.conflict.id); } catch { /* The editor offers a retry. */ }
  }
  return view();
}

async function editorAction(message) {
  if (message.action === "view") {
    const credentials = await auth();
    if (credentials && (credentials.token !== authorizationCheck?.token || Date.now() - authorizationCheck.at > 15000)) {
      authorizationCheck = { token: credentials.token, at: Date.now() };
      try { await verifiedCredentials(); } catch { /* Local editing is also available offline. */ }
    }
    return view();
  }
  if (message.action === "login") return login();
  if (message.action === "logout") {
    const credentials = await auth();
    try { if (credentials) await call("/logout", {}, credentials); }
    finally { await chrome.storage.session.remove("translatorAuth"); }
    return view();
  }
  if (message.action === "edit") {
    await mutate(next => Sync.edit(next, message.word, message.value));
  } else if (message.action === "queueLocal") {
    await mutate(next => {
      const draft = next.drafts.find(row => row.word === message.word && row.mode === "local");
      if (!draft) throw new Error("LOCAL_EDIT_NOT_FOUND");
      draft.mode = "pending";
      draft.requestId = crypto.randomUUID();
      delete draft.reviewRequested;
    });
  } else if (message.action === "download") {
    await download(true);
  } else if (message.action === "fetchConflict") {
    const { word, conflictId } = message;
    if (!(await readState()).drafts.some(draft => draft.word === word && draft.conflict?.id === conflictId)) throw new Error("CONFLICT_NOT_FOUND");
    await fetchConflict(word, conflictId);
  } else if (message.action === "upload") {
    if (!(await readState()).initialized) throw new Error("DICTIONARY_NOT_INITIALIZED");
    const counts = await upload(message.selections);
    return { ...(await view()), counts };
  }
  else if (message.action === "resolve") return resolve(message);
  else throw new Error("UNKNOWN_ACTION");
  return view();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== "dictionary") return false;
  const editor = sender.id === chrome.runtime.id && sender.url?.startsWith(chrome.runtime.getURL("editor/"));
  const action = async () => {
    if (message.action === "read") {
      let current = await readState();
      if (!current.initialized) { await download(); current = await readState(); }
      else void download().catch(() => {});
      return { initialized: current.initialized, terms: Sync.effective(current), revision: current.revision };
    }
    if (!editor) throw new Error("FORBIDDEN");
    return editorAction(message);
  };
  action().then(data => sendResponse({ ok: true, ...data }), error => sendResponse({ ok: false, error: error.message || "SYNC_FAILED" }));
  return true;
});

function start() {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  chrome.alarms.create("dictionary-upload", { periodInMinutes: 1 });
  void download(true).catch(() => {});
}
chrome.runtime.onInstalled.addListener(start);
chrome.runtime.onStartup.addListener(start);
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === "dictionary-upload") void download().catch(() => {}); });
