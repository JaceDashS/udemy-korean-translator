/* The Udemy page can request dictionary data only; editing and authentication are extension only. */
(() => {
  let waiting;
  async function publish() {
    if (waiting) return waiting;
    waiting = chrome.runtime.sendMessage({ target: "dictionary", action: "read" });
    try {
      const answer = await waiting;
      window.postMessage({ source: "udemy-dictionary-extension", ok: answer.ok,
        initialized: answer.initialized === true, terms: answer.terms || [], error: answer.error }, window.location.origin);
    } catch (_) {} finally { waiting = null; }
  }
  window.addEventListener("message", event => {
    if (event.source === window && event.data?.source === "udemy-dictionary-page" && event.data.action === "read") void publish();
  });
  window.addEventListener("online", () => void publish());
  chrome.storage.onChanged.addListener((changes, area) => { if (area === "local" && changes.dictionaryState) void publish(); });
  chrome.runtime.onMessage.addListener(message => { if (message?.target === "dictionary-updated") void publish(); });
  void publish();
})();
