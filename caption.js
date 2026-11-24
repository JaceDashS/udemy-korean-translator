(() => {
  "use strict";

  const key = "__udemyKoreanCaptionTranslator";
  if (window[key]) return;
  window[key] = true;

  const { liveSentences, timedSentences, transcriptSentences } = window.__udemyCaptionSentences;
  const core = window.__udemyKoreanTranslator;
  const cueSelector = '[data-purpose="captions-cue-text"]';
  const transcriptSelector = '[data-purpose="transcript-panel"]';
  const transcriptCueSelector = '[data-purpose="transcript-cue"] [data-purpose="cue-text"]';
  const hideClass = "udemy-ko-caption-hide-source";
  const offKey = "udemyKoreanCaptionOff";
  const originalKey = "udemyKoreanCaptionOriginal";
  const languages = new Set("ar bg bn cs da de el en es fi fr he hi hr hu id it ja kn ko lt mr nl no pl pt ro ru sk sl sv ta te th tr uk vi zh zh-Hant".split(" "));
  let sourceLanguage = "en";
  let model;
  let modelAttempt = 0;
  let detectedLanguage;
  let detector;
  let lastDetection = "";
  let detecting = false;
  function preference(key, value) {
    try {
      if (value !== undefined) localStorage.setItem(key, value ? "1" : "0");
      return localStorage.getItem(key) === "1";
    } catch { return false; }
  }
  const cache = new Map();
  const failed = new Set();
  let active = false;
  let dictionaryVersion;
  let preparing = false;
  let translating = "";
  let video;
  let mediaSource;
  let pagePath;
  let track;
  let trackCues;
  let timeline = [];
  let timelineIndex = -1;
  let transcriptPanel;
  let transcriptObserver;
  let transcriptDirty = false;
  let transcript;
  let transcriptPosition = -1;
  let showingTranscript = false;
  let appendCues = liveSentences();
  let lastCueTime = 0;
  let wanted = [];
  let ahead = [];
  let displayed = [];
  let overlayAvailable = false;

  const css = document.createElement("style");
  css.textContent = `
    html.${hideClass} ${cueSelector} { visibility: hidden !important; }
    video.${hideClass}::cue { opacity: 0 !important; }
    #udemy-ko-caption-controls {
      position: fixed; z-index: 2147483647; display: none;
      align-items: center; gap: 8px; padding: 4px;
      background: #24222b; color: white; border-radius: 7px;
      font: 600 12px/1.4 Arial, sans-serif;
    }
    #udemy-ko-caption-controls button {
      padding: 6px 9px; border: 0; border-radius: 4px;
      background: #6855df; color: white; cursor: pointer;
    }
    #udemy-ko-caption-controls label { padding-right: 4px; cursor: pointer; }
    #udemy-ko-caption-overlay {
      position: fixed; z-index: 2147483646; display: none;
      transform: translateY(-100%); pointer-events: none;
      box-sizing: border-box; padding: 5px 10px; border-radius: 6px;
      background: #000b; color: white; text-align: center;
      white-space: pre-wrap; overflow-wrap: anywhere;
      font: 700 21px/1.45 Arial, sans-serif; text-shadow: 0 1px 3px black;
    }
  `;
  document.head.append(css);

  const controls = document.createElement("div");
  controls.id = "udemy-ko-caption-controls";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "한국어 CC 시작";
  const label = document.createElement("label");
  const showOriginal = document.createElement("input");
  showOriginal.type = "checkbox";
  showOriginal.checked = preference(originalKey);
  label.append(showOriginal, " 원문 함께 보기");
  controls.append(button, label);

  const overlay = document.createElement("div");
  overlay.id = "udemy-ko-caption-overlay";
  document.body.append(controls, overlay);

  function render() {
    const usable = Boolean(active && model && (sourceLanguage !== "en" || dictionaryVersion) && video && overlayAvailable);
    const hide = usable && !wanted.some(text => failed.has(text));
    document.documentElement.classList.toggle(hideClass, hide);
    video?.classList.toggle(hideClass, Boolean(hide && track));
    const text = hide ? displayed.map(source =>
      showOriginal.checked && sourceLanguage !== "ko" ? `${source}\n${cache.get(source)}` : cache.get(source)
    ).join("\n") : "";
    if (overlay.textContent !== text) overlay.textContent = text;
    overlay.style.display = text ? "block" : "none";
  }

  function resetPlayback() {
    appendCues = liveSentences(sourceLanguage);
    lastCueTime = 0;
    timelineIndex = -1;
    transcriptPosition = -1;
    showingTranscript = false;
    displayed = [];
    wanted = [];
    ahead = [];
    render();
  }

  function getVideo() {
    let bestVideo;
    let bestArea = 0;
    for (const candidate of document.querySelectorAll("video")) {
      const rect = candidate.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (rect.width > 120 && rect.height > 90 && area > bestArea) {
        bestVideo = candidate;
        bestArea = area;
      }
    }
    return bestVideo;
  }

  function bindVideo(nextVideo) {
    if (nextVideo === video && nextVideo?.currentSrc === mediaSource &&
        location.pathname === pagePath) return;
    video?.classList.remove(hideClass);
    video?.removeEventListener("seeking", resetPlayback);
    video?.removeEventListener("ended", resetPlayback);
    video = nextVideo;
    mediaSource = video?.currentSrc;
    pagePath = location.pathname;
    detectedLanguage = undefined;
    lastDetection = "";
    track = undefined;
    trackCues = undefined;
    timeline = [];
    transcriptObserver?.disconnect();
    transcriptPanel = undefined;
    transcript = undefined;
    video?.addEventListener("seeking", resetPlayback);
    video?.addEventListener("ended", resetPlayback);
    resetPlayback();
  }

  function getDOMCues(rect) {
    return [...document.querySelectorAll(cueSelector)].flatMap(element => {
      const cue = element.getBoundingClientRect();
      if (!cue.width || !cue.height || cue.right <= rect.left || cue.left >= rect.right ||
          cue.bottom <= rect.top || cue.top >= rect.bottom) return [];
      const text = element.textContent.replace(/\s+/g, " ").trim();
      return text ? [text] : [];
    });
  }

  function selectedTrack() {
    return Array.from(video?.textTracks ?? []).find(candidate =>
      candidate.mode === "showing" && /^(captions|subtitles)$/.test(candidate.kind));
  }

  function normalizeLanguage(value) {
    const tag = value?.toLowerCase().replaceAll("_", "-");
    const language = /^zh-(hant|tw|hk|mo)(-|$)/.test(tag ?? "") ? "zh-Hant" : tag?.split("-")[0];
    return languages.has(language) ? language : undefined;
  }

  function captionLanguage(nativeTrack, cues) {
    const local = document.querySelector(cueSelector);
    const declared = normalizeLanguage(nativeTrack?.language) ??
      normalizeLanguage(local?.getAttribute?.("lang"));
    if (declared) return declared;
    const sample = cues.join(" ");
    if (/[ぁ-ゖァ-ヺ]/u.test(sample)) detectedLanguage = "ja";
    else if (/[가-힣]{2}/u.test(sample)) detectedLanguage = "ko";
    else if (sample.length >= 20 && sample !== lastDetection && !detecting && typeof LanguageDetector !== "undefined") {
      lastDetection = sample;
      detecting = true;
      const page = pagePath;
      void (async () => {
        try {
          detector ??= await LanguageDetector.create();
          const [result] = await detector.detect(sample);
          if (page === pagePath && result?.confidence >= 0.85) {
            detectedLanguage = normalizeLanguage(result.detectedLanguage) ?? detectedLanguage;
          }
        } catch {
          // If detection is unavailable, use the declared language or English fallback.
        } finally { detecting = false; }
      })();
    }
    return detectedLanguage ?? "en";
  }

  function setLanguage(language) {
    if (language === sourceLanguage) return;
    sourceLanguage = language;
    model = undefined;
    modelAttempt++;
    preparing = false;
    button.disabled = false;
    cache.clear();
    failed.clear();
    trackCues = undefined;
    transcriptDirty = Boolean(transcriptPanel);
    transcript = undefined;
    resetPlayback();
    if (active) void prepareModel();
  }

  function readTrack(nextTrack) {
    if (!nextTrack?.cues?.length || normalizeLanguage(nextTrack.language) !== sourceLanguage) nextTrack = undefined;
    const cues = nextTrack?.cues;
    const signature = [cues?.length, cues?.[0], cues?.[cues.length - 1]];
    if (nextTrack !== track || !trackCues ||
        signature.some((value, index) => value !== trackCues[index])) {
      if (nextTrack !== track) resetPlayback();
      track = nextTrack;
      trackCues = signature;
      timeline = Array.from(cues ?? [], cue => ({
        textContent: cue.getCueAsHTML?.().textContent ?? cue.text ?? "",
        startTime: cue.startTime,
        endTime: cue.endTime
      }));
      timeline = timedSentences(timeline, sourceLanguage);
      timelineIndex = -1;
    }
    return Boolean(track);
  }

  function selectTimedSentences(time) {
    // Find the last sentence whose first cue has already started.
    let low = 0;
    let high = timeline.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (timeline[middle].startTime <= time) low = middle + 1;
      else high = middle;
    }

    const current = timeline[low - 1];
    const currentIndex = current && time < current.endTime ? low - 1 : -1;
    if (currentIndex !== timelineIndex || (currentIndex < 0 && wanted.length)) {
      timelineIndex = currentIndex;
      wanted = currentIndex < 0 ? [] : [current.text];
      if (!wanted.length) displayed = [];
    }
    ahead = timeline.slice(low, low + 3).map(sentence => sentence.text);
  }

  function readTranscript() {
    const panel = document.querySelector(transcriptSelector);
    if (panel !== transcriptPanel) {
      transcriptObserver?.disconnect();
      transcriptPanel = panel;
      transcriptDirty = Boolean(panel);
      if (panel) {
        transcriptObserver = new MutationObserver(() => { transcriptDirty = true; });
        transcriptObserver.observe(panel, { childList: true, subtree: true, characterData: true });
      }
    }
    if (transcriptDirty && panel) {
      transcriptDirty = false;
      const rows = [...panel.querySelectorAll(transcriptCueSelector)].map(row => row.textContent);
      if (rows.some(row => row.trim())) {
        transcript = transcriptSentences(rows, sourceLanguage);
        transcriptPosition = -1;
      }
    }
    return transcript;
  }

  function selectTranscriptSentences(cues) {
    if (!readTranscript()) return false;
    const { sentences, byCue, locate } = transcript;
    if (!cues.length) {
      if (transcriptPosition < 0 && video.currentTime < 2) {
        ahead = sentences.slice(0, 3).map(sentence => sentence.text);
      }
      if (!showingTranscript) return false;
      const last = byCue[transcriptPosition]?.at(-1);
      if (last === undefined || sentences[last].last <= transcriptPosition) {
        wanted = [];
        displayed = [];
      }
      return true;
    }
    const joined = locate(cues.join(" "), transcriptPosition);
    const current = joined >= 0 ? joined : cues.map(cue => locate(cue, transcriptPosition))
      .find(index => index >= 0);
    if (current === undefined) return false;
    showingTranscript = true;
    transcriptPosition = current;
    const currentSentences = byCue[current];
    wanted = currentSentences.map(index => sentences[index].text);
    const last = currentSentences.at(-1);
    const next = last === undefined ? sentences.findIndex(sentence => sentence.last > current) : last + 1;
    ahead = next < 0 ? [] : sentences.slice(next, next + 3).map(sentence => sentence.text);
    if (!wanted.length) displayed = [];
    return true;
  }

  function showReady() {
    if (wanted.length && wanted.every(text => cache.has(text))) displayed = wanted;
    render();
  }

  async function translateNext() {
    const version = dictionaryVersion;
    const attempt = modelAttempt;
    const language = sourceLanguage;
    if (!active || !model || (language === "en" && !version) || translating || !overlayAvailable || video?.seeking || video?.ended) return;
    const text = [...wanted, ...ahead].find(source => !cache.has(source) && !failed.has(source));
    if (!text) return;

    translating = text;
    try {
      const result = (await model.translate(text)).trim();
      if (!active || attempt !== modelAttempt || (language === "en" && version !== core.dictionaryVersion())) return;
      if (!result) throw new Error("Empty caption translation");
      cache.set(text, result);
      if (cache.size > 250) {
        const oldest = [...cache.keys()].find(source =>
          !displayed.includes(source) && !wanted.includes(source));
        if (oldest !== undefined) cache.delete(oldest);
      }
    } catch (error) {
      if (active && attempt === modelAttempt && (language !== "en" || version === core.dictionaryVersion())) {
        failed.add(text);
        console.warn("[Udemy KO CC] 번역 오류", error);
      }
    } finally {
      translating = "";
    }
  }

  function update() {
    bindVideo(getVideo());
    if (dictionaryVersion !== core.dictionaryVersion()) {
      dictionaryVersion = core.dictionaryVersion();
      cache.clear();
      failed.clear();
      displayed = [];
    }
    const rect = video?.getBoundingClientRect();
    const fullscreen = document.fullscreenElement;
    const visible = rect && rect.bottom > 0 && rect.top < innerHeight && fullscreen !== video;
    overlayAvailable = Boolean(visible);
    controls.style.display = visible ? "flex" : "none";
    if (!visible) {
      render();
      return;
    }

    controls.style.top = `${Math.max(6, rect.top + 12)}px`;
    controls.style.left = `${Math.max(6, Math.min(innerWidth, rect.right) -
      controls.getBoundingClientRect().width - 12)}px`;
    const inset = Math.min(65, rect.height * 0.14);
    const width = Math.min(rect.width * 0.94, innerWidth - 16);
    overlay.style.top = `${rect.bottom - inset}px`;
    overlay.style.left = `${Math.max(8, rect.left + (rect.width - width) / 2)}px`;
    overlay.style.width = `${width}px`;

    if (active && !video.seeking && !video.ended) {
      const nativeTrack = selectedTrack();
      const cues = getDOMCues(rect);
      setLanguage(captionLanguage(nativeTrack, cues));
      if (readTrack(nativeTrack)) {
        selectTimedSentences(video.currentTime);
      } else if (!selectTranscriptSentences(cues)) {
        if (showingTranscript) {
          appendCues = liveSentences(sourceLanguage);
          showingTranscript = false;
          wanted = [];
          ahead = [];
          displayed = [];
        }
        pickLiveSentences(cues);
      }
      void translateNext();
    }
    showReady();
  }

  function pickLiveSentences(cues) {
    const sentences = appendCues(cues);
    if (sentences.length) wanted = sentences;
    if (cues.length) lastCueTime = video.currentTime;
    // This only clears the overlay. It never completes a sentence.
    else if (video.currentTime - lastCueTime > 2) {
      wanted = [];
      displayed = [];
    }
  }

  function moveToFullscreen() {
    const fullscreen = document.fullscreenElement;
    const parent = fullscreen && fullscreen.tagName !== "VIDEO" ? fullscreen : document.body;
    if (controls.parentElement !== parent) parent.append(controls, overlay);
    update();
  }

  function activate() {
    active = true;
    if (sourceLanguage === "en") model = { translate: core.translate };
    button.textContent = "한국어 CC 끄기";
    update();
  }

  async function prepareModel() {
    if (preparing) return;
    const language = sourceLanguage;
    const attempt = ++modelAttempt;
    preparing = true;
    button.disabled = true;
    button.textContent = "번역 모델 준비 중…";
    try {
      const engine = await core.startCaption(language, percent => {
        if (attempt === modelAttempt) button.textContent = `다운로드 ${percent}%`;
      });
      if (attempt !== modelAttempt) return;
      if (!engine) throw new Error("Caption model unavailable");
      model = language === "en" ? { translate: core.translate } : engine;
      active = true;
      button.textContent = "한국어 CC 끄기";
      update();
    } catch (error) {
      if (attempt !== modelAttempt) return;
      console.warn("[Udemy KO CC] 번역 모델을 열 수 없습니다", error);
      button.textContent = "번역 모델 받기 · 재시도";
    } finally {
      if (attempt === modelAttempt) {
        preparing = false;
        button.disabled = false;
      }
    }
  }

  button.addEventListener("click", () => {
    if (preparing) return;
    if (active && model) {
      active = false;
      preference(offKey, true);
      failed.clear();
      resetPlayback();
      button.textContent = "한국어 CC 시작";
      return;
    }

    preference(offKey, false);
    setLanguage(captionLanguage(selectedTrack(), []));
    void prepareModel();
  });

  showOriginal.addEventListener("change", () => {
    preference(originalKey, showOriginal.checked);
    render();
  });
  document.addEventListener("fullscreenchange", moveToFullscreen);
  setInterval(update, 100);
  moveToFullscreen();
  core.onReady(() => {
    if (!active && !preparing && !preference(offKey)) activate();
  });
})();
