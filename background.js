/* Account operations stay in this service worker and trusted extension pages. */
importScripts("sync-core.js");
const Sync = globalThis.DictionarySync;
const API = "https://api.jace-s.com/udemy-translator";
let state;
let stateQueue = Promise.resolve();
let downloading;
let uploading;
let lastCheck = 0;

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
  if (draft.resolution) {
    if (draft.conflict.ownerId !== credentials.user.id) return;
    const result = await call(`/conflicts/${draft.conflict.id}/resolve`, draft.resolution, credentials);
    await mutate(next => Sync.resolved(next, draft, result));
    return;
  }
  const result = await call("/upload", Sync.request(draft), credentials);
  await mutate(next => Sync.accept(next, draft, result, credentials.user.id));
}

async function runUpload(manual) {
  const credentials = await auth();
  if (!credentials) return;
  const session = await call("/session", undefined, credentials);
  credentials.canUpload = session.canUpload;
  await chrome.storage.session.set({ translatorAuth: credentials });
  if (!session.canUpload) return;
  const snapshot = await readState();
  for (const draft of snapshot.drafts) {
    const latest = await readState();
    const current = latest.drafts.find(row => row.word === draft.word);
    if (!current || current.localRevision !== draft.localRevision) continue;
    if (current.resolution || ((manual || latest.autoUpload) && current.mode === "pending")) await uploadOne(current, credentials);
  }
}

async function flush(manual = false) {
  if (uploading) { await uploading; if (manual) return flush(true); return; }
  uploading = runUpload(manual);
  try { await uploading; } finally { uploading = null; }
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
  void flush().catch(() => {});
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
  const credentials = await auth();
  if (!credentials) throw new Error("UNAUTHENTICATED");
  await mutate(next => {
    const draft = next.drafts.find(row => row.word === message.word && row.conflict?.id === message.conflictId);
    if (!draft || draft.conflict.ownerId !== credentials.user.id) throw new Error("CONFLICT_NOT_FOUND");
    if (!["mine", "server", "local", "later"].includes(message.choice)) throw new Error("INVALID_RESOLUTION");
    draft.resolution = { choice: message.choice, baseRevision: draft.conflict.server.revision, requestId: crypto.randomUUID() };
  });
  await flush();
  return view();
}

async function editorAction(message) {
  if (message.action === "view") return view();
  if (message.action === "login") return login();
  if (message.action === "logout") {
    const credentials = await auth();
    try { if (credentials) await call("/logout", {}, credentials); }
    finally { await chrome.storage.session.remove("translatorAuth"); }
    return view();
  }
  if (message.action === "edit") {
    await mutate(next => Sync.edit(next, message.word, message.value));
    void flush().catch(() => {});
  } else if (message.action === "queueLocal") {
    await mutate(next => {
      const draft = next.drafts.find(row => row.word === message.word && row.mode === "local");
      if (!draft) throw new Error("LOCAL_EDIT_NOT_FOUND");
      draft.mode = "pending";
      draft.requestId = crypto.randomUUID();
    });
    void flush().catch(() => {});
  } else if (message.action === "automatic") {
    await mutate(next => { next.autoUpload = message.enabled === true; });
    if (message.enabled) void flush().catch(() => {});
  } else if (message.action === "download") {
    await download(true);
    void flush().catch(() => {});
  } else if (message.action === "upload") await flush(true);
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
      else void download().then(() => flush()).catch(() => {});
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
  void download(true).then(() => flush()).catch(() => {});
}
chrome.runtime.onInstalled.addListener(start);
chrome.runtime.onStartup.addListener(start);
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === "dictionary-upload") void flush().catch(() => {}); });
