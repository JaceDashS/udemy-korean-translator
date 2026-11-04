
/*
 * Udemy Local Quiz Translator v1.3.0
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

    .udemy-quiz-inline-translation .uqt-label {
      display: block;
      margin-bottom: 3px;
      color: #5289e8;
      font-size: 11px;
      font-weight: 700;
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

    const label = document.createElement("span");
    label.className = "uqt-label";
    label.textContent = kind === "question" ? "문제 번역" : "선택지 번역";

    const translated = document.createElement("span");
    translated.className = "uqt-text";
    translated.textContent = text;

    box.append(label, translated);

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
   * The Udemy DOM structure is never changed in side mode.
   */
  const SIDE_MIN_WIDTH = 240;
  const SIDE_MAX_WIDTH = 560;
  const SIDE_GAP = 16;
  const SIDE_STACK_GAP = 8;
  let sideLayout = null;
  let relayoutFrame = 0;

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
  function sideColumn(cards, scroller) {
    const cardsRight = Math.max(...cards.map(c => c.getBoundingClientRect().right));
    const limit = visibleRect(scroller).right;
    const space = limit - cardsRight - SIDE_GAP * 2;

    if (space < SIDE_MIN_WIDTH) return null;
    return { left: cardsRight + SIDE_GAP, width: Math.min(space, SIDE_MAX_WIDTH) };
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

    document.body.append(layer);
    sideLayout = { layer, items, cards, scroller };
    positionSide();
  }

  function positionSide() {
    if (!sideLayout) return true;
    const { layer, items, cards, scroller } = sideLayout;

    const column = sideColumn(cards, scroller);
    if (!column) return false;

    const clip = visibleRect(scroller);
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

    return true;
  }

  // Reposition on scroll/resize; switch between side and below when space changes.
  function relayout() {
    relayoutFrame = 0;
    if (!lastRendered) return;

    const { quiz, questionKo, answersKo } = lastRendered;
    if (quiz.nodes.cards.some(card => !card.isConnected)) return;

    const scroller = scrollParentOf(quiz.nodes.cards[0]);
    const wantSide = !!sideColumn(quiz.nodes.cards, scroller);

    if (wantSide === !!sideLayout && positionSide()) return;
    showInlineTranslations(quiz, questionKo, answersKo);
  }

  function requestRelayout() {
    if (!relayoutFrame) relayoutFrame = requestAnimationFrame(relayout);
  }

  addEventListener("scroll", requestRelayout, { capture: true, passive: true });
  addEventListener("resize", requestRelayout, { passive: true });

  function showInlineTranslations(quiz, questionKo, answersKo) {
    clearInlineTranslations();
    const cards = quiz.nodes.cards;
    if (!cards.length || cards.some(card => !card.isConnected)) return;

    const scroller = scrollParentOf(cards[0]);
    if (sideColumn(cards, scroller)) {
      showSideTranslations(quiz, questionKo, answersKo, scroller);
      return;
    }

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

  function extractQuiz() {
    const headerNode = findText(
      /^(?:Question|질문)\s*(\d+)\s*:/i
    );

    if (!headerNode) return null;

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

    const answers = cards.map((card, i) => {
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

  // Keep dictionary terms in English. If the translator drops a placeholder,
  // fall back to a plain translation instead of showing a broken sentence.
  async function translateWithDictionary(source) {
    if (!dictionary) return translator.translate(source);

    const { text, terms } = dictionary.protect(source);
    if (!terms.length) return translator.translate(source);

    const restored = dictionary.restore(await translator.translate(text), terms);
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

  async function update() {
    if (!translator) return;

    const quiz = extractQuiz();

    if (!quiz) {
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

  // Development helpers.
  window.udemyLocalTranslator = {
    start: () => initialize(),
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
      removeEventListener("resize", requestRelayout);

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

  void autoStart();
})();
