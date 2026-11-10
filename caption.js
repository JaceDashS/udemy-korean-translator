/*
 * Korean Translator for Udemy: live caption translation.
 * Chrome 138+ / English -> Korean, on-device Translator API.
 * Shows Korean captions over the video and hides the English ones only while
 * the Korean text is ready. The translator, the dictionary, and the cache are
 * shared with the quiz (translator.js).
 */
(() => {
  "use strict";

  const KEY = "__udemyKoreanCaptionTranslator";
  const LOG = "[Korean Translator]";
  const core = window.__udemyKoreanTranslator;

  if (window[KEY]) return;
  window[KEY] = true;

  // Stop an older DevTools prototype, if present.
  try {
    window.stopUdemyLiveCC?.();
  } catch (_) {}

  const CAPTION_SELECTOR =
    '[data-purpose="captions-cue-text"]';

  const HIDE_CLASS =
    "udemy-ko-caption-hide-source";

  // Finished translations, so a repeated caption shows at once. The shared
  // core caches the promises; this map holds the resolved text.
  const cache = new Map();
  const failed = new Set();

  let active = false;
  let preparing = false;
  let translating = false;
  let desired = "";
  let removed = false;

  // ==================================================
  // Styles
  // ==================================================

  const css = document.createElement("style");

  css.textContent = `
    html.${HIDE_CLASS} ${CAPTION_SELECTOR} {
      visibility: hidden !important;
    }

    #udemy-ko-caption-toggle {
      position: fixed !important;
      z-index: 2147483647 !important;
      display: none;
      pointer-events: auto !important;
      padding: 8px 12px;
      border: 0;
      border-radius: 7px;
      background: #6855df;
      color: white;
      font: 600 12px Arial, sans-serif;
      cursor: pointer;
      box-shadow: 0 3px 12px #0008;
    }

    #udemy-ko-caption-overlay {
      position: fixed !important;
      z-index: 2147483646 !important;
      display: none;
      pointer-events: none !important;
      padding: 5px 10px;
      border-radius: 6px;
      color: white;
      background: rgba(0, 0, 0, .65);
      text-align: center;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font: 700 21px/1.45 Arial, sans-serif;
      text-shadow: 0 1px 3px black;
      transform: translateY(-100%);
    }
  `;

  document.head.append(css);

  // ==================================================
  // UI
  // ==================================================

  const button = document.createElement("button");

  button.id = "udemy-ko-caption-toggle";
  button.type = "button";
  button.textContent = "한국어 CC 시작";

  const overlay = document.createElement("div");

  overlay.id = "udemy-ko-caption-overlay";
  overlay.setAttribute("aria-live", "off");

  document.body.append(button, overlay);

  // ==================================================
  // Video detection
  // ==================================================

  function getVideo() {
    return [...document.querySelectorAll("video")]
      .filter(v =>
        v.getBoundingClientRect().width > 120
      )
      .sort((a, b) => {
        const area = v => {
          const r = v.getBoundingClientRect();
          return r.width * r.height;
        };

        return area(b) - area(a);
      })[0] || null;
  }

  function currentCaptions(video) {
    if (!video) return [];

    const vr = video.getBoundingClientRect();

    return [...document.querySelectorAll(
      CAPTION_SELECTOR
    )]
      .map(el => ({
        el,
        rect: el.getBoundingClientRect()
      }))
      .filter(({ rect }) =>
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right > vr.left &&
        rect.left < vr.right &&
        rect.bottom > vr.top &&
        rect.top < vr.bottom
      );
  }

  function englishText(captions) {
    return captions
      .map(({ el }) =>
        (el.textContent || "").trim()
      )
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // ==================================================
  // Caption visibility
  // ==================================================

  function hideEnglish(shouldHide) {
    document.documentElement.classList.toggle(
      HIDE_CLASS,
      shouldHide
    );
  }

  function clearKorean() {
    hideEnglish(false);

    overlay.textContent = "";
    overlay.style.display = "none";
  }

  function setKorean(source, korean) {
    if (
      !active ||
      removed ||
      source !== desired
    ) return;

    if (!korean) {
      clearKorean();
      return;
    }

    overlay.textContent = korean;
    overlay.style.display = "block";

    // Hide English only after Korean is ready.
    hideEnglish(true);
    positionUI();
  }

  // ==================================================
  // Translation queue and cache
  // ==================================================

  async function drain() {
    if (
      translating ||
      !core.isReady() ||
      !active ||
      removed
    ) return;

    translating = true;

    let inFlight = "";

    try {
      while (
        active &&
        !removed &&
        desired &&
        !cache.has(desired) &&
        !failed.has(desired)
      ) {
        inFlight = desired;

        const korean =
          await core.translate(inFlight);

        if (!active || removed) break;

        cache.set(inFlight, korean);

        // Limit in-memory cache size.
        if (cache.size > 250) {
          cache.delete(
            cache.keys().next().value
          );
        }

        // Ignore outdated translations.
        if (desired === inFlight) {
          setKorean(inFlight, korean);
        }
      }

      if (
        active &&
        desired &&
        cache.has(desired)
      ) {
        setKorean(
          desired,
          cache.get(desired)
        );
      }
    } catch (error) {
      console.error(LOG, "Caption translation failed.", error);

      if (inFlight && active && !removed) {
        failed.add(inFlight);
      }

      if (active && desired === inFlight) {
        clearKorean();
      }
    } finally {
      translating = false;

      if (
        active &&
        desired &&
        !cache.has(desired) &&
        !failed.has(desired)
      ) {
        void drain();
      }
    }
  }

  // ==================================================
  // Real-time caption detection
  // ==================================================

  function detectCaptions() {
    if (!active || removed) return;

    const next = englishText(
      currentCaptions(getVideo())
    );

    if (next === desired) return;

    desired = next;

    // Keep English visible until translation finishes.
    clearKorean();

    if (!next) return;

    if (cache.has(next)) {
      setKorean(next, cache.get(next));
    } else if (!failed.has(next)) {
      void drain();
    }
  }

  // ==================================================
  // Overlay positioning
  // ==================================================

  function positionUI() {
    if (removed) return;

    const video = getVideo();

    if (!video) {
      button.style.display = "none";
      desired = "";
      clearKorean();
      return;
    }

    const r = video.getBoundingClientRect();

    const onscreen =
      r.width > 120 &&
      r.height > 90 &&
      r.bottom > 0 &&
      r.top < innerHeight;

    button.style.display =
      onscreen ? "block" : "none";

    if (!onscreen) {
      overlay.style.display = "none";
      hideEnglish(false);
      return;
    }

    const bw =
      button.getBoundingClientRect().width || 130;

    button.style.left = `${
      Math.max(
        6,
        Math.min(
          innerWidth - bw - 6,
          r.right - bw - 12
        )
      )
    }px`;

    button.style.top =
      `${Math.max(6, r.top + 12)}px`;

    const captions = currentCaptions(video);

    const bottom = captions.length
      ? Math.max(
          ...captions.map(({ rect }) => rect.bottom)
        )
      : r.bottom - Math.min(
          65,
          r.height * 0.14
        );

    const width = Math.max(
      140,
      Math.min(
        r.width - 20,
        r.width * 0.94
      )
    );

    overlay.style.left =
      `${r.left + (r.width - width) / 2}px`;

    overlay.style.width =
      `${width}px`;

    overlay.style.top = `${
      Math.max(
        r.top + 28,
        Math.min(r.bottom - 6, bottom)
      )
    }px`;

    // Match Udemy's caption font size.
    if (captions.length) {
      const fontSize = parseFloat(
        getComputedStyle(
          captions[0].el
        ).fontSize
      );

      if (Number.isFinite(fontSize)) {
        overlay.style.fontSize = `${
          Math.max(
            15,
            Math.min(28, fontSize)
          )
        }px`;
      }
    }

    // Native video fullscreen cannot host the
    // separate overlay; preserve English in that case.
    const nativeVideoFullscreen =
      document.fullscreenElement === video;

    if (nativeVideoFullscreen) {
      overlay.style.display = "none";
      hideEnglish(false);
    } else if (
      active &&
      overlay.textContent &&
      desired
    ) {
      overlay.style.display = "block";
      hideEnglish(true);
    }
  }

  // ==================================================
  // Start translation
  // ==================================================

  async function start() {
    if (
      preparing ||
      active ||
      removed
    ) return;

    preparing = true;
    button.disabled = true;

    button.textContent =
      "번역 모델 준비 중…";

    try {
      // Called from the button click, which a model download needs.
      const ready = await core.start(percent => {
        button.textContent = `다운로드 ${percent}%`;
      });
      if (!ready) {
        throw new Error("Chrome Translator API를 사용할 수 없습니다.");
      }

      if (removed) return;

      active = true;
      desired = "";

      button.textContent =
        "한국어 CC 끄기 ×";

      console.info(LOG, "Caption translation started.");

      detectCaptions();
    } catch (error) {
      console.error(LOG, "Caption translation could not start.", error);

      button.textContent =
        "시작 실패 · 재시도";
    } finally {
      preparing = false;
      button.disabled = false;
    }
  }

  // ==================================================
  // Stop translation
  // ==================================================

  function stop() {
    active = false;
    desired = "";

    failed.clear();
    clearKorean();

    button.textContent =
      "한국어 CC 시작";

    console.info(LOG, "Caption translation stopped; English captions restored.");
  }

  // Korean captions start by themselves. Turning them off with the button is
  // remembered on this browser until the user turns them on again.
  const OFF_KEY = "udemyKoreanCaptionOff";

  function remembersOff() {
    try {
      return localStorage.getItem(OFF_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function rememberOff(off) {
    try {
      if (off) localStorage.setItem(OFF_KEY, "1");
      else localStorage.removeItem(OFF_KEY);
    } catch (_) {}
  }

  button.addEventListener("click", () => {
    if (active) {
      stop();
      rememberOff(true);
    } else {
      rememberOff(false);
      void start();
    }
  });

  // The shared translator is ready at once when the model is installed, or
  // after the first page click when it must be downloaded.
  const stopWaitingForTranslator = core.onReady(() => {
    if (!remembersOff()) void start();
  });

  // ==================================================
  // Fullscreen support
  // ==================================================

  function moveToFullscreen() {
    const fs = document.fullscreenElement;

    const parent =
      fs && fs.tagName !== "VIDEO"
        ? fs
        : document.body;

    if (button.parentElement !== parent) {
      parent.append(button);
    }

    if (overlay.parentElement !== parent) {
      parent.append(overlay);
    }

    positionUI();
  }

  document.addEventListener(
    "fullscreenchange",
    moveToFullscreen
  );

  // ==================================================
  // Update loop
  // ==================================================

  // Udemy may replace caption DOM nodes during playback.
  const timer = setInterval(() => {
    if (removed) return;

    positionUI();
    detectCaptions();
  }, 150);

  // ==================================================
  // Cleanup
  // ==================================================

  function destroy() {
    if (removed) return;

    stop();
    removed = true;
    stopWaitingForTranslator();

    clearInterval(timer);

    document.removeEventListener(
      "fullscreenchange",
      moveToFullscreen
    );

    css.remove();
    button.remove();
    overlay.remove();

    delete window[KEY];
    delete window.udemyKoreanCaption;
  }

  // Developer helpers
  window.udemyKoreanCaption = {
    start,
    stop,
    destroy
  };

  positionUI();
})();
