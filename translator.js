/*
 * Korean Translator for Udemy: shared translation core.
 * Used by the quiz (content.js) and the captions (caption.js).
 * - One on-device Chrome Translator (English -> Korean) for the whole page
 * - A persistent dictionary supplied by the isolated extension bridge
 * - One translation cache
 */
(() => {
  "use strict";

  const KEY = "__udemyKoreanTranslator";
  if (window[KEY]) return;

  const LOG = "[Korean Translator]";
  const LANGS = { sourceLanguage: "en", targetLanguage: "ko" };
  const CACHE_LIMIT = 1000;

  let translator = null;
  let creating = null;
  const readyCallbacks = new Set();
  const progressCallbacks = new Set();
  const cache = new Map();
  const dictionary = window.__udemyQuizTranslatorDictionary;

  // ---- Dictionary terms ----------------------------------------------------

  const GLOSSARY_LIMITS = { terms: 10000, length: 200 };

  // The file is data only: every row needs a short word, and may have a string
  // meaning and a boolean exact flag. Anything else is rejected.
  function isValidTerms(terms) {
    if (!Array.isArray(terms) || terms.length > GLOSSARY_LIMITS.terms) return false;

    return terms.every(
      row =>
        row &&
        typeof row === "object" &&
        typeof row.word === "string" &&
        row.word.trim().length > 0 &&
        row.word.length <= GLOSSARY_LIMITS.length &&
        (row.meaning == null ||
          (typeof row.meaning === "string" && row.meaning.length <= GLOSSARY_LIMITS.length)) &&
        (row.exact === undefined || typeof row.exact === "boolean")
    );
  }

  // The page receives dictionary data only. Passwords and upload authority never cross this bridge.
  let completeInitialLoad;
  const glossaryReady = new Promise(resolve => { completeInitialLoad = resolve; });
  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== window.location.origin || event.data?.source !== "udemy-dictionary-extension") return;
    const data = event.data;
    if (!data.ok || !data.initialized || !isValidTerms(data.terms)) {
      console.warn(LOG, "Open the dictionary side panel and complete the initial server synchronization.");
      return;
    }
    dictionary?.configure(data.terms);
    cache.clear();
    completeInitialLoad();
  });
  window.postMessage({ source: "udemy-dictionary-page", action: "read" }, window.location.origin);

  // ---- Translator ----------------------------------------------------------

  // Creates the translator once. A model download needs a user gesture, so a
  // click handler (caption button, first page click) may call this directly.
  // onProgress receives 0-100 while the model downloads.
  async function start(onProgress) {
    if (translator) return translator;
    if (onProgress) progressCallbacks.add(onProgress);
    if (creating) return creating;

    if (typeof Translator === "undefined" || typeof Translator.create !== "function") {
      console.warn(LOG, "Translator API is unavailable. Chrome 138+ desktop is required.");
      return null;
    }

    creating = (async () => {
      try {
        translator = await Translator.create({
          ...LANGS,
          monitor(m) {
            m.addEventListener("downloadprogress", e => {
              const percent = Math.round(e.loaded * 100);
              console.info(LOG, `Model download ${percent}%`);
              for (const callback of progressCallbacks) callback(percent);
            });
          }
        });
        for (const callback of readyCallbacks) callback();
        return translator;
      } catch (error) {
        console.error(LOG, "Failed to start the translator.", error);
        return null;
      } finally {
        creating = null;
        progressCallbacks.clear();
      }
    })();
    return creating;
  }

  function startOnFirstGesture() {
    const begin = () => {
      document.removeEventListener("pointerdown", begin, true);
      document.removeEventListener("keydown", begin, true);
      void start();
    };
    document.addEventListener("pointerdown", begin, true);
    document.addEventListener("keydown", begin, true);
    console.info(LOG, "Waiting for a page click to download the translation model.");
  }

  async function autoStart() {
    if (typeof Translator === "undefined") {
      console.warn(LOG, "Translator API is unavailable. Chrome 138+ desktop is required.");
      return;
    }

    try {
      const availability = await Translator.availability(LANGS);

      if (availability === "available") {
        void start();
      } else if (availability === "downloadable" || availability === "downloading") {
        startOnFirstGesture();
      } else {
        console.warn(LOG, `English to Korean translation is ${availability}.`);
      }
    } catch (error) {
      console.error(LOG, "Failed to check translator availability.", error);
    }
  }

  // ---- Translation -----------------------------------------------------------

  // Kept terms stay in English; pairs are replaced with their Korean meaning.
  // If the translator drops a placeholder, fall back to a plain translation
  // instead of showing a broken sentence.
  async function translateWithDictionary(source) {
    await glossaryReady;
    if (!translator) throw new Error("The translator is not ready.");
    if (!dictionary) return translator.translate(source);

    const { text, terms, meanings } = dictionary.protect(source);
    if (!terms.length) return translator.translate(source);

    const restored = dictionary.restore(await translator.translate(text), terms, meanings);
    if (restored !== null) return restored;

    console.debug(LOG, "Dictionary placeholder lost; using plain translation.", source);
    return translator.translate(source);
  }

  // Same text, same promise: the quiz and the captions share the results.
  function translate(source) {
    if (!source) return Promise.resolve("");
    if (cache.has(source)) return cache.get(source);

    const promise = translateWithDictionary(source).catch(error => {
      cache.delete(source);
      throw error;
    });

    cache.set(source, promise);
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
    return promise;
  }

  window[KEY] = {
    isReady: () => Boolean(translator),
    start,
    // Calls back once the translator is ready (at once if it already is).
    // Returns a function that removes the callback.
    onReady(callback) {
      if (translator) {
        callback();
        return () => {};
      }
      readyCallbacks.add(callback);
      return () => readyCallbacks.delete(callback);
    },
    translate
  };

  void glossaryReady.then(autoStart);
})();
