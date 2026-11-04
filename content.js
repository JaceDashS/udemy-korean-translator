
/*
 * Udemy Local Quiz Translator v1.0.3
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

  const SETTINGS = "udemy-local-quiz-translator-settings-v1";
  const defaults = {
    left: null,
    top: null,
    width: 450,
    height: 520,
    autoOpen: false
  };

  let saved = { ...defaults };

  try {
    saved = {
      ...defaults,
      ...JSON.parse(localStorage.getItem(SETTINGS) || "{}")
    };
  } catch (_) {}

  const host = document.createElement("div");
  host.id = "udemy-local-quiz-translator-host";
  host.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:2147483647;";

  const shadow = host.attachShadow({ mode: "open" });
  const styles = document.createElement("style");

  styles.textContent = `
    * { box-sizing: border-box; }

    button {
      font: inherit;
      cursor: pointer;
    }

    #launcher {
      position: fixed;
      right: 16px;
      bottom: 16px;
      pointer-events: auto;
      padding: 11px 16px;
      border: 1px solid #899cff;
      border-radius: 999px;
      background: #212d49;
      color: #fff;
      box-shadow: 0 4px 18px #0006;
      font: 600 13px/1.2 system-ui, sans-serif;
      white-space: nowrap;
    }

    #shell {
      position: fixed;
      pointer-events: auto;
      display: none;
      overflow: hidden;
      resize: both;
      min-width: 245px;
      min-height: 155px;
      max-width: calc(100vw - 12px);
      max-height: calc(100vh - 12px);
      background: #17202d;
      color: #f1f5fa;
      border: 1px solid #4d617e;
      border-radius: 11px;
      box-shadow: 0 12px 38px #0008;
      font: 13px/1.55 system-ui, sans-serif;
    }

    #header {
      height: 44px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 10px;
      background: #101827;
      border-bottom: 1px solid #34435a;
      user-select: none;
      touch-action: none;
      cursor: grab;
    }

    #header.dragging { cursor: grabbing; }

    #title {
      font-weight: 700;
      white-space: nowrap;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    }

    #status {
      font-size: 10px;
      color: #a3b5d1;
      white-space: nowrap;
      max-width: 88px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .action {
      border: 0;
      background: #26344a;
      color: #fff;
      border-radius: 6px;
      width: 26px;
      height: 26px;
      flex: none;
      font-size: 16px;
      line-height: 24px;
      padding: 0;
    }

    .action:hover, #launcher:hover {
      filter: brightness(1.22);
    }

    #body {
      overflow: auto;
      height: calc(100% - 44px);
      padding: 12px;
      scrollbar-width: thin;
    }

    .message {
      padding: 15px 12px;
      border: 1px solid #405472;
      border-radius: 8px;
      background: #233147;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    #start {
      margin-top: 12px;
      display: block;
      padding: 10px 12px;
      background: #7565e8;
      border: none;
      border-radius: 7px;
      color: white;
      font-weight: 700;
    }

    .q-head {
      font-weight: 700;
      font-size: 13px;
      margin: 0 0 10px;
      color: #d8e5ff;
    }

    .label {
      color: #a5c4fd;
      font-size: 10px;
      font-weight: 750;
      letter-spacing: .03em;
      margin-bottom: 5px;
    }

    .card {
      padding: 11px 12px;
      margin-bottom: 9px;
      border-radius: 8px;
      border: 1px solid #40516a;
      background: #27364b;
      overflow-wrap: anywhere;
    }

    .card.correct {
      border-color: #39856e;
      background: #194333;
    }

    .card.wrong {
      border-color: #bc6b6b;
      background: #492b35;
    }

    .card.selected:not(.correct):not(.wrong) {
      border-color: #8e84fc;
    }

    .card p {
      margin: 0;
      white-space: pre-wrap;
    }

    .explanation {
      margin-top: 9px;
      border-top: 1px solid #ffffff38;
      padding-top: 9px;
      white-space: pre-wrap;
      color: #e0e8f4;
    }

    #shell.minimized {
      resize: none !important;
      min-height: 44px !important;
      height: 44px !important;
    }

    #shell.minimized #body {
      display: none;
    }

    #shell.minimized #header {
      border-bottom: none;
      cursor: default;
    }
  `;

  shadow.append(styles);

  const launcher = document.createElement("button");
  launcher.id = "launcher";
  launcher.type = "button";
  launcher.textContent = "번역 열기";
  launcher.title = "Udemy 한국어 번역 패널 열기";

  const shell = document.createElement("section");
  shell.id = "shell";
  shell.setAttribute("aria-label", "Udemy 한국어 자동 번역");

  const header = document.createElement("div");
  header.id = "header";

  const title = document.createElement("span");
  title.id = "title";
  title.textContent = "⋮⋮  Udemy 한국어 번역";

  const status = document.createElement("span");
  status.id = "status";
  status.textContent = "대기";

  const refreshBtn = makeButton("↻", "번역 다시 확인");
  const minimizeBtn = makeButton("−", "최소화 / 복원");
  const closeBtn = makeButton("×", "패널 닫기");

  header.append(
    title,
    status,
    refreshBtn,
    minimizeBtn,
    closeBtn
  );

  const body = document.createElement("div");
  body.id = "body";

  shell.append(header, body);
  shadow.append(launcher, shell);

  (document.body || document.documentElement).append(host);

  function makeButton(text, tooltip) {
    const b = document.createElement("button");
    b.className = "action";
    b.textContent = text;
    b.type = "button";
    b.title = tooltip;
    b.setAttribute("aria-label", tooltip);
    return b;
  }

  function store() {
    try {
      localStorage.setItem(SETTINGS, JSON.stringify(saved));
    } catch (_) {}
  }

  function clamp(value, lo, hi) {
    return Math.max(lo, Math.min(hi, value));
  }

  function dimensions() {
    const w = clamp(
      Number(saved.width) || 450,
      245,
      Math.max(245, innerWidth - 12)
    );

    const h = clamp(
      Number(saved.height) || 520,
      155,
      Math.max(155, innerHeight - 12)
    );

    return { w, h };
  }

  function positionShell() {
    const { w, h } = dimensions();

    const x = saved.left === null
      ? Math.max(6, innerWidth - w - 20)
      : clamp(
          Number(saved.left) || 6,
          6,
          Math.max(6, innerWidth - w - 6)
        );

    const y = saved.top === null
      ? Math.max(6, innerHeight - h - 20)
      : clamp(
          Number(saved.top) || 6,
          6,
          Math.max(6, innerHeight - h - 6)
        );

    Object.assign(shell.style, {
      width: `${w}px`,
      height: `${h}px`,
      left: `${x}px`,
      top: `${y}px`
    });
  }

  function saveBounds() {
    if (shell.classList.contains("minimized")) return;

    const r = shell.getBoundingClientRect();

    if (!r.width || !r.height) return;

    Object.assign(saved, {
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height
    });

    store();
  }

  positionShell();

  let translator = null;
  let creating = null;
  let visible = false;
  let minimized = false;
  let seq = 0;
  let lastKey = "";
  let debounceTimer;
  let lastUrl = location.href;

  const cache = new Map();
  const INLINE_ATTRIBUTE = "data-udemy-quiz-inline";
  const INLINE_SELECTOR = `[${INLINE_ATTRIBUTE}]`;
  let inlineNodes = [];
  let lastRendered = null;

  // Inline translations appear on the Udemy page, not inside the panel's shadow DOM.
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
  `;
  (document.head || document.documentElement).append(inlineStyles);

  function clearInlineTranslations() {
    for (const node of document.querySelectorAll(INLINE_SELECTOR)) {
      node.remove();
    }
    inlineNodes = [];
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

  function showInlineTranslations(quiz, questionKo, answersKo) {
    clearInlineTranslations();
    const cards = quiz.nodes.cards;
    if (!cards.length || cards.some(card => !card.isConnected)) return;

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

  function notice(message, showStart = false) {
    body.replaceChildren();

    const msg = document.createElement("div");
    msg.className = "message";
    msg.textContent = message;
    body.append(msg);

    if (showStart) {
      const button = document.createElement("button");
      button.id = "start";
      button.type = "button";
      button.textContent = "로컬 번역 시작 / 모델 다운로드";
      button.onclick = () => {
        void initialize();
      };
      body.append(button);
    }
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
      status.textContent = "미지원";
      notice(
        "이 Chrome에서 Translator API를 사용할 수 없습니다. " +
        "Chrome 138 이상 데스크톱 버전인지 확인하세요.",
        true
      );
      return;
    }

    status.textContent = "준비 중";
    notice(
      "Chrome 내장 번역기를 준비 중입니다. " +
      "첫 사용 시 언어 모델 다운로드가 필요할 수 있습니다."
    );

    try {
      const promise = Translator.create({
        sourceLanguage: "en",
        targetLanguage: "ko",
        monitor(m) {
          m.addEventListener("downloadprogress", e => {
            status.textContent =
              `다운로드 ${Math.round(e.loaded * 100)}%`;
          });
        }
      });

      creating = promise;
      translator = await promise;

      status.textContent = "자동 감지";
      lastKey = "";
      schedule(true);
    } catch (error) {
      status.textContent = "오류";

      notice(
        "번역기를 시작하지 못했습니다.\n" +
        String(error?.message || error) +
        "\n\n아래 버튼을 클릭해 다시 시도하세요.",
        true
      );
    } finally {
      creating = null;
    }
  }

  function openPanel(autostart = false) {
    visible = true;

    shell.style.display = "block";
    launcher.style.display = "none";

    if (minimized) toggleMinimize();

    saved.autoOpen = true;
    store();

    if (translator) {
      schedule(true);
    } else if (!autostart) {
      void initialize();
    } else {
      notice(
        "번역기를 시작하려면 아래 버튼을 클릭하세요.",
        true
      );

      if (typeof Translator !== "undefined") {
        Translator.availability({
          sourceLanguage: "en",
          targetLanguage: "ko"
        })
          .then(v => {
            if (
              visible &&
              !translator &&
              v === "available"
            ) {
              void initialize();
            }
          })
          .catch(() => {});
      }
    }
  }

  function closePanel() {
    saveBounds();

    visible = false;
    ++seq;
    lastKey = "";
    lastRendered = null;
    clearInlineTranslations();

    shell.style.display = "none";
    launcher.style.display = "block";

    saved.autoOpen = false;
    store();
  }

  /*
   * v1.0.2
   * Minimize -> always dock to bottom-right.
   * Restore -> recover previous dimensions and position.
   */

  function dockMinimized() {
    const w = Math.min(
      265,
      Math.max(245, innerWidth - 12)
    );

    const h = 44;

    Object.assign(shell.style, {
      width: `${w}px`,
      height: `${h}px`,
      left: `${Math.max(6, innerWidth - w - 16)}px`,
      top: `${Math.max(6, innerHeight - h - 16)}px`
    });
  }

  function toggleMinimize() {
    if (!minimized) {
      // Save expanded coordinates before minimizing.
      saveBounds();

      minimized = true;
      shell.classList.add("minimized");

      minimizeBtn.textContent = "□";
      minimizeBtn.title = "복원";

      // Always move to the bottom-right corner.
      dockMinimized();
    } else {
      shell.classList.remove("minimized");
      minimized = false;

      minimizeBtn.textContent = "−";
      minimizeBtn.title = "최소화";

      // Restore the previous panel position and size.
      positionShell();
    }
  }

  launcher.addEventListener("click", () => openPanel());

  closeBtn.addEventListener("click", closePanel);

  minimizeBtn.addEventListener(
    "click",
    toggleMinimize
  );

  refreshBtn.addEventListener("click", () => {
    lastKey = "";

    if (translator) {
      schedule(true);
    } else {
      void initialize();
    }
  });

  // Header dragging is enabled only while expanded.
  header.addEventListener("pointerdown", e => {
    if (
      minimized ||
      e.button !== 0 ||
      e.target.closest("button")
    ) return;

    const start = shell.getBoundingClientRect();
    const x0 = e.clientX;
    const y0 = e.clientY;

    header.setPointerCapture(e.pointerId);
    header.classList.add("dragging");

    const move = ev => {
      shell.style.left = `${
        clamp(
          start.left + ev.clientX - x0,
          6,
          Math.max(6, innerWidth - shell.offsetWidth - 6)
        )
      }px`;

      shell.style.top = `${
        clamp(
          start.top + ev.clientY - y0,
          6,
          Math.max(6, innerHeight - shell.offsetHeight - 6)
        )
      }px`;
    };

    const end = () => {
      header.classList.remove("dragging");

      header.removeEventListener("pointermove", move);
      header.removeEventListener("pointerup", end);
      header.removeEventListener("pointercancel", end);

      saveBounds();
    };

    header.addEventListener("pointermove", move);
    header.addEventListener("pointerup", end);
    header.addEventListener("pointercancel", end);
  });

  shell.addEventListener("pointerup", () => {
    if (!minimized) saveBounds();
  });

  // Keep the minimized panel docked during window resizing.
  window.addEventListener("resize", () => {
    if (minimized) {
      dockMinimized();
    } else {
      saveBounds();
      positionShell();
    }
  });

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
      if (host.contains(n) || n.parentElement?.closest(INLINE_SELECTOR)) {
        continue;
      }

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

    return { number, question, answers, nodes: { cards } };
  }

  function translateCached(source) {
    if (!source) return Promise.resolve("");

    if (cache.has(source)) {
      return cache.get(source);
    }

    const p = translator.translate(source)
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

  function addCard(
    label,
    content,
    statusKind = "",
    explanation = ""
  ) {
    const card = document.createElement("article");
    card.className = `card ${statusKind}`;

    const heading = document.createElement("div");
    heading.className = "label";
    heading.textContent = label;

    const p = document.createElement("p");
    p.textContent = content;

    card.append(heading, p);

    if (explanation) {
      const expl = document.createElement("div");
      expl.className = "explanation";
      expl.textContent = "해설\n" + explanation;
      card.append(expl);
    }

    body.append(card);
  }

  function render(quiz, questionKo, answersKo) {
    body.replaceChildren();

    const heading = document.createElement("div");
    heading.className = "q-head";
    heading.textContent =
      `문제 ${quiz.number} · 한국어 번역`;

    body.append(heading);

    addCard("QUESTION", questionKo);

    answersKo.forEach((a, i) => {
      const letter = String.fromCharCode(65 + i);

      const outcome = a.status === "correct"
        ? " · 정답"
        : a.status === "wrong"
          ? " · 오답"
          : "";

      addCard(
        `선택지 ${letter}${a.selected ? " · 선택됨" : ""}${outcome}`,
        a.ko,
        `${a.status} ${a.selected ? "selected" : ""}`.trim(),
        a.explanationKo
      );
    });

    status.textContent = "자동 감지 중";
  }

  async function update() {
    if (!visible || !translator) return;

    const quiz = extractQuiz();

    if (!quiz) {
      ++seq; // An in-flight translation must not render an obsolete question.
      lastKey = "";
      lastRendered = null;
      clearInlineTranslations();
      status.textContent = "퀴즈 대기";

      notice(
        "Udemy 퀴즈를 찾지 못했습니다. " +
        "시험 문제 화면으로 이동하면 자동 번역합니다."
      );

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
      }
      return;
    }

    lastKey = key;
    const mySeq = ++seq;
    lastRendered = null;
    clearInlineTranslations();

    status.textContent = "번역 중";
    notice(`문제 ${quiz.number} 번역 중…`);

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

      if (mySeq !== seq || !visible) return;

      // Keep the original panel, and ALSO insert translations in the quiz DOM.
      render(quiz, questionKo, answersKo);
      showInlineTranslations(quiz, questionKo, answersKo);
      lastRendered = {
        key,
        questionKo,
        answersKo,
        cards: [...quiz.nodes.cards]
      };
    } catch (error) {
      if (mySeq !== seq || !visible) return;

      lastKey = "";
      lastRendered = null;
      clearInlineTranslations();
      status.textContent = "번역 오류";

      notice(
        "번역 실패: " +
        String(error?.message || error) +
        "\n\n↻ 버튼을 눌러 다시 시도하세요."
      );

      console.error("[Udemy Local Translator]", error);
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
    if (host.contains(target)) return true;
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
    if (!visible || !translator) return;
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

      if (translator && visible) {
        schedule(true);
      }
    }
  }, 1200);

  // Development helpers.
  window.udemyLocalTranslator = {
    open: () => openPanel(),
    close: closePanel,
    refresh: () => {
      lastKey = "";
      schedule(true);
    },
    destroy: () => {
      observer.disconnect();
      clearTimeout(debounceTimer);
      clearInterval(interval);

      ++seq;
      clearInlineTranslations();
      inlineStyles.remove();
      lastRendered = null;

      try {
        translator?.destroy();
      } catch (_) {}

      host.remove();

      delete window[INSTANCE];
      delete window.udemyLocalTranslator;
    }
  };

  if (saved.autoOpen) {
    openPanel(true);
  } else {
    notice(
      "번역 열기를 클릭하면 Udemy 문제를 번역합니다.",
      true
    );
  }
})();
