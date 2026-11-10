
/*
 * Udemy Local Quiz Translator v1.5.1
 * Chrome 138+ / English -> Korean
 * On-device Translator API
 */
(() => {
  "use strict";

  const INSTANCE = "__udemyLocalQuizTranslatorV1";
  if (window[INSTANCE]) return;
  window[INSTANCE] = true;

  try {
    window.stopQuizTranslation?.();
  } catch (_) {}

  const LOG = "[Udemy Local Translator]";
  const LANGS = { sourceLanguage: "en", targetLanguage: "ko" };

  let translator = null;
  let creating = null;
  let seq = 0;
  let lastKey = "";
  let debounceTimer;
  let lastUrl = location.href;

  const cache = new Map();
  const INLINE_ATTRIBUTE = "data-udemy-quiz-inline";
  const INLINE_SELECTOR = `[${INLINE_ATTRIBUTE}]`;
  let inlineNodes = [];
  let lastRendered = null;

  // Inline translations appear directly on the Udemy page.
  const inlineStyles = document.createElement("style");
  inlineStyles.id = "udemy-quiz-inline-translator-styles";
  inlineStyles.textContent = `
    .udemy-quiz-inline-translation {
      box-sizing: border-box !important;
      display: block !important;
      flex-basis: 100%;
      grid-column: 1 / -1;
      min-width: 0;
      margin: 8px 0 12px !important;
      padding: 8px 11px !important;
      border-left: 3px solid #5289e8 !important;
      border-radius: 4px;
      background: rgba(82, 137, 232, .09) !important;
      color: inherit !important;
      font: inherit !important;
      line-height: 1.6 !important;
      list-style: none !important;
      overflow-wrap: anywhere;
      white-space: normal;
    }

    .udemy-quiz-inline-translation .uqt-text,
    .udemy-quiz-inline-translation .uqt-explanation {
      display: block;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .udemy-quiz-inline-translation .uqt-explanation {
      margin-top: 7px;
      padding-top: 7px;
      border-top: 1px solid rgba(82, 137, 232, .25);
    }

    .uqt-side-layer {
      position: fixed;
      z-index: 1000;
      overflow: hidden;
      pointer-events: none;
    }

    .uqt-side-layer .udemy-quiz-inline-translation.uqt-side {
      position: absolute !important;
      margin: 0 !important;
      pointer-events: auto;
    }
  `;
  (document.head || document.documentElement).append(inlineStyles);

  function clearInlineTranslations() {
    for (const node of document.querySelectorAll(INLINE_SELECTOR)) {
      node.remove();
    }
    inlineNodes = [];
    sideLayout = null;
    restoreShift();
  }

  function makeInlineTranslation(text, kind, explanation = "", anchor = null) {
    // Keep <ul>/<ol> children valid when an option is an <li>.
    const tag = anchor?.tagName === "LI" &&
      /^(UL|OL)$/.test(anchor.parentElement?.tagName || "")
      ? "li"
      : "div";

    const box = document.createElement(tag);
    box.className = "udemy-quiz-inline-translation";
    box.setAttribute(INLINE_ATTRIBUTE, kind);

    const translated = document.createElement("span");
    translated.className = "uqt-text";
    translated.textContent = text;

    box.append(translated);

    if (explanation) {
      const detail = document.createElement("span");
      detail.className = "uqt-explanation";
      detail.textContent = `해설\n${explanation}`;
      box.append(detail);
    }

    return box;
  }

  /*
   * Side layout: when the quiz column has enough empty space to the right of
   * the answer cards, translations float there in a fixed layer and follow
   * their originals on scroll. Otherwise they are inserted below (fallback).
   * Udemy centers the quiz column; in side mode only its horizontal margins
   * are overridden so the original and the translation are centered as a pair.
   * Udemy elements are never moved; only our own nodes are added.
   */
  const SIDE_MIN_WIDTH = 240;
  const SIDE_MAX_WIDTH = 560;
  const SIDE_GAP = 16;
  const SIDE_STACK_GAP = 8;
  const SHIFT_MIN_MARGIN = 24;
  const CENTERED_MIN_GAP = 40;
  let sideLayout = null;
  let shift = null;
  let relayoutFrame = 0;
  let relayoutFull = false;

  // Overflowing or not, a scroll container is the quiz column's boundary.
  function isScrollable(element) {
    return /(auto|scroll|overlay)/.test(getComputedStyle(element).overflowY);
  }

  // The nearest scroll container bounds both the free space and the clip area,
  // so translations never cover a sidebar next to the quiz column.
  function scrollParentOf(element) {
    for (let el = element.parentElement; el && el !== document.body; el = el.parentElement) {
      if (isScrollable(el)) return el;
    }
    return null;
  }

  function visibleRect(scroller) {
    const view = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    if (!scroller) return view;

    const r = scroller.getBoundingClientRect();
    return {
      left: Math.max(view.left, r.left),
      top: Math.max(view.top, r.top),
      right: Math.min(view.right, r.right),
      bottom: Math.min(view.bottom, r.bottom)
    };
  }

  // Returns where the side column starts and how wide it can be, or null.
  // A box may be as wide as the original column, but at least SIDE_MAX_WIDTH.
  function sideColumn(cards, scroller) {
    const rects = cards.map(c => c.getBoundingClientRect());
    const cardsRight = Math.max(...rects.map(r => r.right));
    const cardsWidth = cardsRight - Math.min(...rects.map(r => r.left));
    const limit = visibleRect(scroller).right;
    const space = limit - cardsRight - SIDE_GAP * 2;

    if (space < SIDE_MIN_WIDTH) return null;
    return {
      left: cardsRight + SIDE_GAP,
      width: Math.min(space, Math.max(SIDE_MAX_WIDTH, cardsWidth))
    };
  }

  function horizontalGaps(el) {
    const parent = el.parentElement;
    const ps = getComputedStyle(parent);
    const p = parent.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const contentLeft = p.left + parseFloat(ps.paddingLeft) + parseFloat(ps.borderLeftWidth);
    const contentRight = p.right - parseFloat(ps.paddingRight) - parseFloat(ps.borderRightWidth);
    return { left: r.left - contentLeft, right: contentRight - r.right, contentLeft, width: r.width };
  }

  // Innermost ancestor holding the whole quiz that is centered in its parent
  // (margin auto, flex, or grid centering all look the same geometrically).
  function centeredColumn(quiz, scroller) {
    const { cards, header } = quiz.nodes;
    for (let el = cards[0].parentElement; el && el.parentElement; el = el.parentElement) {
      if (el === scroller || el === document.body) break;
      if (header && !el.contains(header)) continue;
      if (!cards.every(card => el.contains(card))) continue;

      const gaps = horizontalGaps(el);
      if (gaps.left > CENTERED_MIN_GAP && Math.abs(gaps.left - gaps.right) <= 4) {
        return { el, ...gaps };
      }
    }
    return null;
  }

  function applyShift(el, marginLeft) {
    shift = {
      el,
      applied: `${Math.round(marginLeft)}px`,
      previous: ["margin-left", "margin-right"].map(name => ({
        name,
        value: el.style.getPropertyValue(name),
        priority: el.style.getPropertyPriority(name)
      }))
    };
    el.style.setProperty("margin-left", shift.applied, "important");
    el.style.setProperty("margin-right", "auto", "important");
  }

  function restoreShift() {
    if (!shift) return;
    for (const { name, value, priority } of shift.previous) {
      if (value) shift.el.style.setProperty(name, value, priority);
      else shift.el.style.removeProperty(name);
    }
    shift = null;
  }

  // Left margin that centers original + translation as a pair, or null when
  // the column is already at least that far left.
  function shiftTarget(column, scroller) {
    const room = visibleRect(scroller).right - column.contentLeft;
    const translationWidth = Math.max(SIDE_MAX_WIDTH, column.width);
    const pair = column.width + SIDE_GAP * 2 + translationWidth;
    const target = Math.max(SHIFT_MIN_MARGIN, (room - pair) / 2);
    return target < column.left - 1 ? target : null;
  }

  // Move the centered column left so original + translation are centered together.
  function shiftForSide(quiz, scroller) {
    const column = centeredColumn(quiz, scroller);
    if (!column) return;

    const target = shiftTarget(column, scroller);
    if (target !== null) applyShift(column.el, target);
  }

  // Udemy can finish centering the column after the first render, or re-render
  // the column and drop the override. Either way the layout must be rebuilt.
  function shiftIsStale(quiz, scroller) {
    if (shift) {
      return !shift.el.isConnected ||
        shift.el.style.getPropertyValue("margin-left") !== shift.applied;
    }
    const column = centeredColumn(quiz, scroller);
    return !!column && shiftTarget(column, scroller) !== null;
  }

  function showSideTranslations(quiz, questionKo, answersKo, scroller) {
    const cards = quiz.nodes.cards;
    const reference = getComputedStyle(cards[0]);

    const layer = document.createElement("div");
    layer.className = "uqt-side-layer";
    layer.setAttribute(INLINE_ATTRIBUTE, "layer");
    layer.style.color = reference.color;
    layer.style.fontFamily = reference.fontFamily;
    layer.style.fontSize = reference.fontSize;

    const items = [{
      anchor: quiz.nodes.header?.isConnected ? quiz.nodes.header : cards[0],
      box: makeInlineTranslation(questionKo, "question")
    }];

    cards.forEach((card, i) => {
      items.push({
        anchor: card,
        box: makeInlineTranslation(answersKo[i].ko, "answer", answersKo[i].explanationKo)
      });
    });

    for (const { box } of items) {
      box.classList.add("uqt-side");
      layer.append(box);
      inlineNodes.push(box);
    }

    // Side boxes can be taller than the quiz. The spacer extends the page
    // after the last answer so the scroll container can reach every box.
    const last = cards[cards.length - 1];
    const spacer = document.createElement(last.tagName === "LI" ? "li" : "div");
    spacer.setAttribute(INLINE_ATTRIBUTE, "spacer");
    spacer.style.cssText = "display:block;height:0;margin:0;padding:0;list-style:none;";
    last.after(spacer);

    document.body.append(layer);
    sideLayout = { quiz, layer, items, cards, scroller, spacer };
    positionSide();
  }

  function positionSide() {
    if (!sideLayout) return true;
    const { quiz, layer, items, cards, scroller, spacer } = sideLayout;

    if (shiftIsStale(quiz, scroller)) return false;

    const column = sideColumn(cards, scroller);
    if (!column) return false;

    // A sidebar opening or closing changes the width without a resize event;
    // the column shift must then be recalculated.
    const clip = visibleRect(scroller);
    const clipWidth = clip.right - clip.left;
    if (sideLayout.clipWidth === undefined) sideLayout.clipWidth = clipWidth;
    else if (Math.abs(sideLayout.clipWidth - clipWidth) > 1) return false;

    Object.assign(layer.style, {
      left: `${clip.left}px`,
      top: `${clip.top}px`,
      width: `${Math.max(0, clip.right - clip.left)}px`,
      height: `${Math.max(0, clip.bottom - clip.top)}px`
    });

    // Align each box with its original; push down when the previous box is taller.
    let previousBottom = -Infinity;
    for (const { anchor, box } of items) {
      const top = Math.max(anchor.getBoundingClientRect().top, previousBottom + SIDE_STACK_GAP);
      box.style.left = `${column.left - clip.left}px`;
      box.style.top = `${top - clip.top}px`;
      box.style.width = `${column.width}px`;
      previousBottom = top + box.offsetHeight;
    }

    // Grow only by what the boxes overflow below the last answer.
    const overflow = previousBottom - cards[cards.length - 1].getBoundingClientRect().bottom;
    spacer.style.height = `${Math.max(0, Math.ceil(overflow) + SIDE_STACK_GAP)}px`;

    return true;
  }

  // Scroll and content changes only reposition. A resize changes the free
  // width, so the layout is rebuilt from the cached translations.
  function relayout() {
    const full = relayoutFull;
    relayoutFrame = 0;
    relayoutFull = false;
    if (!lastRendered) return;

    const { quiz, questionKo, answersKo } = lastRendered;
    if (quiz.nodes.cards.some(card => !card.isConnected)) return;

    if (!full && positionSide()) return;
    showInlineTranslations(quiz, questionKo, answersKo);
  }

  function requestRelayout() {
    if (!relayoutFrame) relayoutFrame = requestAnimationFrame(relayout);
  }

  function requestFullRelayout() {
    relayoutFull = true;
    requestRelayout();
  }

  addEventListener("scroll", requestRelayout, { capture: true, passive: true });
  addEventListener("resize", requestFullRelayout, { passive: true });

  function showInlineTranslations(quiz, questionKo, answersKo) {
    clearInlineTranslations();
    const cards = quiz.nodes.cards;
    if (!cards.length || cards.some(card => !card.isConnected)) return;

    const scroller = scrollParentOf(cards[0]);
    shiftForSide(quiz, scroller);
    if (sideColumn(cards, scroller)) {
      showSideTranslations(quiz, questionKo, answersKo, scroller);
      return;
    }
    restoreShift();

    // The translated question goes between the original question and first answer.
    const questionBox = makeInlineTranslation(
      questionKo, "question", "", cards[0]
    );
    cards[0].before(questionBox);
    inlineNodes.push(questionBox);

    // Each translated choice follows its original choice without changing the input.
    cards.forEach((card, i) => {
      const translated = answersKo[i];
      const answerBox = makeInlineTranslation(
        translated.ko,
        "answer",
        translated.explanationKo,
        card
      );
      card.after(answerBox);
      inlineNodes.push(answerBox);
    });
  }

  function inlineIsCurrent(quiz) {
    return !!lastRendered &&
      lastRendered.cards.length === quiz.nodes.cards.length &&
      lastRendered.cards.every((card, i) =>
        card === quiz.nodes.cards[i] && card.isConnected
      ) &&
      inlineNodes.length === quiz.nodes.cards.length + 1 &&
      inlineNodes.every(node => node.isConnected);
  }

  // A model download needs user activation, so it waits for the first page click.
  function startOnFirstGesture() {
    const start = () => {
      document.removeEventListener("pointerdown", start, true);
      document.removeEventListener("keydown", start, true);
      void initialize();
    };
    document.addEventListener("pointerdown", start, true);
    document.addEventListener("keydown", start, true);
    console.info(LOG, "Waiting for a page click to download the translation model.");
  }

  async function initialize() {
    if (translator) {
      schedule(true);
      return;
    }

    if (creating) return;

    if (
      typeof Translator === "undefined" ||
      typeof Translator.create !== "function"
    ) {
      console.warn(LOG, "Translator API is unavailable. Chrome 138+ desktop is required.");
      return;
    }

    try {
      const promise = Translator.create({
        ...LANGS,
        monitor(m) {
          m.addEventListener("downloadprogress", e => {
            console.info(LOG, `Model download ${Math.round(e.loaded * 100)}%`);
          });
        }
      });

      creating = promise;
      translator = await promise;

      lastKey = "";
      schedule(true);
    } catch (error) {
      console.error(LOG, "Failed to start the translator.", error);
    } finally {
      creating = null;
    }
  }

  // Terms are loaded from the dictionary branch on each page load, so a change
  // takes effect without reloading the extension. The bundled list in
  // dictionary-terms.js stays in use when the download fails.
  const GLOSSARY_URL =
    "https://raw.githubusercontent.com/JaceDashS/udemy-quiz-translator/dictionary/dictionary.json";
  const GLOSSARY_TIMEOUT_MS = 3000;
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

  async function loadGlossary() {
    const dictionary = window.__udemyQuizTranslatorDictionary;
    if (!dictionary) return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GLOSSARY_TIMEOUT_MS);

    try {
      const response = await fetch(GLOSSARY_URL, {
        cache: "no-store",
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (data?.version !== 2 || !isValidTerms(data.terms)) {
        throw new Error("Invalid dictionary file.");
      }

      dictionary.configure(data.terms);
      console.info(LOG, `Loaded ${data.terms.length} dictionary terms.`);
    } catch (error) {
      console.warn(LOG, "Using the bundled dictionary terms.", error);
    } finally {
      clearTimeout(timer);
    }
  }

  async function autoStart() {
    if (typeof Translator === "undefined") {
      console.warn(LOG, "Translator API is unavailable. Chrome 138+ desktop is required.");
      return;
    }

    try {
      const availability = await Translator.availability(LANGS);

      if (availability === "available") {
        void initialize();
      } else if (availability === "downloadable" || availability === "downloading") {
        startOnFirstGesture();
      } else {
        console.warn(LOG, `English to Korean translation is ${availability}.`);
      }
    } catch (error) {
      console.error(LOG, "Failed to check translator availability.", error);
    }
  }

  // Extract Udemy question and answer elements.
  const CONTROL =
    'input[type="radio"],input[type="checkbox"],' +
    '[role="radio"],[role="checkbox"]';

  function isAfter(a, b) {
    return !!(
      a.compareDocumentPosition(b) &
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  }

  function findText(pattern) {
    const walk = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
    );

    let n;

    while ((n = walk.nextNode())) {
      if (n.parentElement?.closest(INLINE_SELECTOR)) continue;

      if (pattern.test((n.nodeValue || "").trim())) {
        return n;
      }
    }

    return null;
  }

  // innerText includes the visible injected translations. Temporarily hide
  // only our nodes while reading the original answer and feedback text.
  function originalInnerText(element) {
    const nodes = [...element.querySelectorAll(INLINE_SELECTOR)];
    if (!nodes.length) return element.innerText || "";

    const previous = nodes.map(node => ({
      node,
      value: node.style.getPropertyValue("display"),
      priority: node.style.getPropertyPriority("display")
    }));

    try {
      nodes.forEach(node => node.style.setProperty("display", "none", "important"));
      return element.innerText || "";
    } finally {
      for (const { node, value, priority } of previous) {
        if (value) node.style.setProperty("display", value, priority);
        else node.style.removeProperty("display");
      }
    }
  }

  function cardOf(control) {
    let cur = control;
    let best = control.parentElement;

    while (
      cur.parentElement &&
      cur.parentElement !== document.body
    ) {
      const p = cur.parentElement;

      if (p.querySelectorAll(CONTROL).length !== 1) {
        break;
      }

      const text = originalInnerText(p).trim();

      if (text.length >= 8 && text.length < 6000) {
        best = p;
      }

      cur = p;
    }

    return best;
  }

  let lastNoQuizReason = "";

  // Logs why a quiz was not detected, once per reason, so new page layouts can be debugged.
  function noQuiz(reason) {
    if (reason !== lastNoQuizReason) {
      lastNoQuizReason = reason;
      console.info(LOG, "Quiz not detected:", reason);
    }
    return null;
  }

  // Reads each answer's text, selection, and feedback from its card.
  function readAnswers(cards, controls) {
    return cards.map((card, i) => {
      const lines = originalInnerText(card)
        .split(/\n+/)
        .map(s => s.trim())
        .filter(Boolean);

      const raw = lines[0] || "";

      const source = raw.replace(
        /\s*(?:Correct|Try again|Incorrect)\s*$/i,
        ""
      ).trim();

      const feedback = lines.slice(1).filter(s =>
        !/^(Correct|Incorrect|Try again|Explain this further|Show explanation)$/i.test(s)
      );

      const isCorrect = lines.some(s =>
        /(?:^|\s)Correct\s*$/i.test(s)
      );

      const isWrong = lines.some(s =>
        /(?:^|\s)(?:Try again|Incorrect)\s*$/i.test(s)
      );

      const el = controls[i];

      return {
        source,
        selected: el.matches("input")
          ? el.checked
          : el.getAttribute("aria-checked") === "true",
        status: isCorrect
          ? "correct"
          : isWrong
            ? "wrong"
            : "",
        explanation: feedback.join("\n").trim()
      };
    });
  }

  // Exam-style pages have no "Question N:" heading. The answer form itself
  // (data-testid="mc-quiz-question") is the quiz; its text before the first
  // answer is the question.
  function extractFormQuiz() {
    const form = document.querySelector('[data-testid="mc-quiz-question"]');
    if (!form) return null;

    const controls = [...form.querySelectorAll(CONTROL)];
    const natives = controls.filter(n => n.matches("input"));
    const picked = natives.length >= 2
      ? natives
      : controls.filter(n => n.matches("[role]"));
    if (picked.length < 2 || picked.length > 12) return null;

    const cards = picked.map(cardOf);
    const answers = readAnswers(cards, picked);
    if (answers.some(a => !a.source)) return null;

    // The question text may sit in the form or in a container just above it.
    let question = "";
    let container = form;
    for (let depth = 0; depth < 4 && container && container !== document.body && !question; depth++) {
      const lines = originalInnerText(container)
        .split(/\n+/)
        .map(s => s.trim())
        .filter(Boolean);
      const first = lines.findIndex(line => line.startsWith(answers[0].source));
      if (first > 0 && first < 30) question = lines.slice(0, first).join(" ");
      container = container.parentElement;
    }
    if (!question) return noQuiz("question text not found near the answer form");

    return {
      number: "form",
      question,
      answers,
      nodes: { cards, header: form.firstElementChild || form }
    };
  }

  function extractQuiz() {
    const headerNode = findText(
      /^(?:Question|질문)\s*(\d+)\s*:/i
    );

    if (!headerNode) return extractFormQuiz();

    const number = headerNode.nodeValue.match(
      /(?:Question|질문)\s*(\d+)\s*:/i
    )?.[1];

    if (!number) return null;

    const footerNode = findText(
      new RegExp(
        `^(?:Question\\s*${number}\\s*of\\s*\\d+|\\d+\\s*의\\s*질문\\s*${number})$`,
        "i"
      )
    );

    const candidates = [
      ...document.querySelectorAll(CONTROL)
    ].filter(n =>
      isAfter(headerNode, n) &&
      (!footerNode || isAfter(n, footerNode))
    );

    const natives = candidates.filter(n =>
      n.matches("input")
    );

    const controls = natives.length >= 2
      ? natives
      : candidates.filter(n => n.matches("[role]"));

    if (
      controls.length < 2 ||
      controls.length > 12
    ) {
      return null;
    }

    const cards = controls.map(cardOf);
    const answers = readAnswers(cards, controls);

    if (answers.some(a => !a.source)) {
      return null;
    }

    let question = "";

    try {
      const range = document.createRange();

      range.setStartAfter(headerNode);
      range.setEndBefore(cards[0]);

      // Ignore previously injected translations in the question range.
      const fragment = range.cloneContents();
      fragment.querySelectorAll(INLINE_SELECTOR).forEach(node => node.remove());
      question = (fragment.textContent || "").trim();
    } catch (_) {}

    if (!question) {
      const all = document.body.innerText;

      const prefix = new RegExp(
        `(?:Question|질문)\\s*${number}\\s*:\\s*`,
        "i"
      );

      const start = prefix.exec(all);

      if (start) {
        const rest = all.slice(
          start.index + start[0].length
        );

        const boundary = rest.indexOf(
          answers[0].source
        );

        if (boundary > 0) {
          question = rest.slice(0, boundary).trim();
        }
      }
    }

    if (!question) return null;

    question = question.replace(
      /^\s*(?:Question|질문)\s*\d+\s*:/i,
      ""
    ).trim();

    return {
      number,
      question,
      answers,
      nodes: { cards, header: headerNode.parentElement }
    };
  }

  const dictionary = window.__udemyQuizTranslatorDictionary;

  // Kept terms stay in English; pairs are replaced with their Korean meaning.
  // If the translator drops a placeholder, fall back to a plain translation
  // instead of showing a broken sentence.
  async function translateWithDictionary(source) {
    if (!dictionary) return translator.translate(source);

    const { text, terms, meanings } = dictionary.protect(source);
    if (!terms.length) return translator.translate(source);

    const restored = dictionary.restore(await translator.translate(text), terms, meanings);
    if (restored !== null) return restored;

    console.debug(LOG, "Dictionary placeholder lost; using plain translation.", source);
    return translator.translate(source);
  }

  function translateCached(source) {
    if (!source) return Promise.resolve("");

    if (cache.has(source)) {
      return cache.get(source);
    }

    const p = translateWithDictionary(source)
      .catch(err => {
        cache.delete(source);
        throw err;
      });

    cache.set(source, p);

    if (cache.size > 350) {
      cache.delete(cache.keys().next().value);
    }

    return p;
  }

  // Exam result page (after submitting a practice exam). The selectors were
  // checked on one CCAR-F practice exam result page. Other exam types are not
  // verified, so these are the only result selectors used.
  const EXAM_RESULT = '[class*="question-result--question-result"]';
  const EXAM_QUESTION_BODY = ".rt-scaffolding";
  const EXAM_ANSWER_PANE = '[class*="result-pane--answer-result-pane"]';
  const EXAM_ANSWER_BODY = '[class*="answer-result-pane--answer-body"]';
  const EXAM_FEEDBACK = '[class*="answer-result-pane--answer-feedback"]';
  const EXAM_EXPLANATION = '[class*="result-pane--question-related-fields"]';
  const EXAM_MAX_TEXT = 6000;

  // Each text block keeps the element it is translated after. The key lists
  // only the source texts, so re-rendering with the same text is skipped.
  function extractExamResult() {
    const containers = [...document.querySelectorAll(EXAM_RESULT)];
    if (!containers.length) return null;

    const blocks = [];
    const add = (anchor, kind, textEl = anchor) => {
      if (!anchor || !textEl) return;
      const source = (textEl.innerText || "").replace(/[ \t]+\n/g, "\n").trim();
      if (!source || source.length > EXAM_MAX_TEXT) return;
      blocks.push({ el: anchor, kind, source });
    };

    for (const container of containers) {
      add(container.querySelector(EXAM_QUESTION_BODY), "question");

      for (const pane of container.querySelectorAll(EXAM_ANSWER_PANE)) {
        add(pane, "answer", pane.querySelector(EXAM_ANSWER_BODY));
      }

      add(container.querySelector(EXAM_FEEDBACK), "feedback");
      add(container.querySelector(EXAM_EXPLANATION), "explanation");
    }

    if (!blocks.length) return null;

    return {
      key: JSON.stringify(blocks.map(b => b.source)),
      blocks
    };
  }

  let examRenderedKey = "";
  let examNodes = [];

  async function updateExam(exam) {
    if (
      exam.key === examRenderedKey &&
      examNodes.length &&
      examNodes.every(node => node.isConnected)
    ) {
      return;
    }

    const mySeq = ++seq;
    examRenderedKey = "";
    clearInlineTranslations();

    const translated = [];
    for (const block of exam.blocks) {
      translated.push(await translateCached(block.source));
    }

    // Skip stale results when the page changed during translation.
    if (mySeq !== seq) return;

    examNodes = [];
    exam.blocks.forEach((block, i) => {
      if (!block.el.isConnected) return;
      const box = makeInlineTranslation(translated[i], block.kind);
      block.el.after(box);
      examNodes.push(box);
    });
    examRenderedKey = exam.key;
  }

  async function update() {
    if (!translator) return;

    const quiz = extractQuiz();

    if (!quiz) {
      const exam = extractExamResult();
      if (exam) {
        lastKey = "";
        lastRendered = null;
        try {
          await updateExam(exam);
        } catch (error) {
          examRenderedKey = "";
          console.error(LOG, "Exam translation failed.", error);
        }
        return;
      }

      examRenderedKey = "";
      ++seq; // An in-flight translation must not render an obsolete question.
      lastKey = "";
      lastRendered = null;
      clearInlineTranslations();
      return;
    }

    // DOM references must not be serialized as part of the content key.
    const key = JSON.stringify({
      number: quiz.number,
      question: quiz.question,
      answers: quiz.answers
    });

    if (key === lastKey) {
      // Udemy can replace its answer elements with identical text.
      if (lastRendered?.key === key && !inlineIsCurrent(quiz)) {
        showInlineTranslations(
          quiz, lastRendered.questionKo, lastRendered.answersKo
        );
        lastRendered.cards = [...quiz.nodes.cards];
        lastRendered.quiz = quiz;
      } else {
        // Feedback or explanations can change the card heights.
        requestRelayout();
      }
      return;
    }

    lastKey = key;
    const mySeq = ++seq;
    lastRendered = null;
    clearInlineTranslations();

    try {
      const questionKo = await translateCached(quiz.question);
      const answersKo = [];

      for (const a of quiz.answers) {
        answersKo.push({
          ...a,
          ko: await translateCached(a.source),
          explanationKo: await translateCached(a.explanation)
        });
      }

      if (mySeq !== seq) return;

      showInlineTranslations(quiz, questionKo, answersKo);
      lastRendered = {
        key,
        quiz,
        questionKo,
        answersKo,
        cards: [...quiz.nodes.cards]
      };
    } catch (error) {
      if (mySeq !== seq) return;

      lastKey = "";
      lastRendered = null;
      clearInlineTranslations();
      console.error(LOG, "Translation failed.", error);
    }
  }

  function schedule(immediate = false) {
    clearTimeout(debounceTimer);

    debounceTimer = setTimeout(
      update,
      immediate ? 0 : 400
    );
  }

  // Automatically detect dynamic page changes, excluding our own inline DOM.
  function isOwnMutation(mutation) {
    const target = mutation.target;
    if (target.parentElement?.closest(INLINE_SELECTOR)) return true;
    if (target.nodeType === Node.ELEMENT_NODE &&
        target.closest(INLINE_SELECTOR)) return true;

    if (mutation.type === "childList") {
      const changed = [...mutation.addedNodes, ...mutation.removedNodes];
      return changed.length > 0 && changed.every(node =>
        node.nodeType === Node.ELEMENT_NODE && node.matches(INLINE_SELECTOR)
      );
    }
    return false;
  }

  const observer = new MutationObserver(mutations => {
    if (!translator) return;
    if (mutations.every(isOwnMutation)) return;
    schedule();
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [
      "class",
      "checked",
      "aria-checked"
    ]
  });

  const interval = setInterval(() => {
    if (lastUrl !== location.href) {
      lastUrl = location.href;

      if (translator) {
        schedule(true);
      }
    }
  }, 1200);

  // Describes the quiz layout so a wrong side placement can be diagnosed.
  function layoutInfo() {
    const quiz = lastRendered?.quiz || extractQuiz();
    if (!quiz) return "No quiz found.";

    const scroller = scrollParentOf(quiz.nodes.cards[0]);
    const name = el => el
      ? el.tagName.toLowerCase() +
        (el.id ? `#${el.id}` : "") +
        [...el.classList].slice(0, 2).map(c => `.${c}`).join("")
      : "window";

    const chain = [];
    for (let el = quiz.nodes.cards[0]; el && el !== document.body; el = el.parentElement) {
      const cs = getComputedStyle(el);
      const g = el.parentElement ? horizontalGaps(el) : {};
      chain.push({
        el: name(el),
        width: Math.round(el.getBoundingClientRect().width),
        gapLeft: Math.round(g.left),
        gapRight: Math.round(g.right),
        display: cs.display,
        justify: cs.justifyContent,
        margin: `${cs.marginLeft} ${cs.marginRight}`,
        overflowY: cs.overflowY
      });
    }

    return {
      mode: sideLayout ? "side" : inlineNodes.length ? "below" : "none",
      shifted: shift ? name(shift.el) : null,
      scroller: name(scroller),
      viewport: innerWidth,
      chain
    };
  }

  // Development helpers.
  window.udemyLocalTranslator = {
    start: () => initialize(),
    layoutInfo,
    refresh: () => {
      lastKey = "";
      schedule(true);
    },
    destroy: () => {
      observer.disconnect();
      clearTimeout(debounceTimer);
      clearInterval(interval);
      cancelAnimationFrame(relayoutFrame);
      removeEventListener("scroll", requestRelayout, { capture: true });
      removeEventListener("resize", requestFullRelayout);

      ++seq;
      clearInlineTranslations();
      inlineStyles.remove();
      lastRendered = null;

      try {
        translator?.destroy();
      } catch (_) {}

      delete window[INSTANCE];
      delete window.udemyLocalTranslator;
    }
  };

  void loadGlossary().then(autoStart);
})();
