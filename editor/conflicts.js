/*
 * Same-term conflicts: opens editor/conflict.html in a new window and waits
 * for the user's choice per term.
 *
 * askConflicts(items) → Promise of Map(path → "mine" | "current"), or null
 * when the window was closed without choosing.
 * items: [{ path, word, mine: term | null, current: term | null }]
 * (null means the term is deleted on that side)
 *
 * The window asks for the items and sends the choices back with
 * chrome.runtime messages ({ target: "conflicts" }).
 */
(() => {
  "use strict";

  // Opened outside the extension, the editor is read-only and never asks.
  if (typeof chrome === "undefined" || !chrome.windows) return;

  let pending = null;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.target !== "conflicts" || !pending) return false;
    if (message.action === "get") {
      sendResponse({ items: pending.items, title: pending.title });
      return false;
    }
    if (message.action === "done") {
      const done = pending;
      pending = null;
      done.resolve(new Map(Object.entries(message.choices || {})));
      chrome.windows.remove(done.windowId).catch(() => {});
    }
    return false;
  });

  chrome.windows.onRemoved.addListener(windowId => {
    if (pending?.windowId !== windowId) return;
    const done = pending;
    pending = null;
    done.resolve(null);
  });

  async function askConflicts(items, title = "") {
    if (pending) {
      chrome.windows.update(pending.windowId, { focused: true }).catch(() => {});
      return null;
    }
    return new Promise(resolve => {
      pending = { items, title, resolve, windowId: null };
      chrome.windows.create({
        url: chrome.runtime.getURL("editor/conflict.html"),
        type: "popup",
        width: 720,
        height: 560
      }).then(win => {
        if (pending) pending.windowId = win.id;
      }).catch(() => {
        pending = null;
        resolve(null);
      });
    });
  }

  globalThis.__dictionaryConflicts = { askConflicts };
})();
