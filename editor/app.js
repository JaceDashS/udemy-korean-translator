    "use strict";

    const REPO = "JaceDashS/udemy-quiz-translator";
    const BRANCH = "dictionary";
    const RAW_URL = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/dictionary.json`;
    // GitHub Pages: the helper started from a terminal (HTTP).
    const HELPER_URL = "http://127.0.0.1:8787";
    // Side panel: an extension page, so Chrome starts the helper through native messaging.
    const NATIVE_HOST = "com.udemy.dictionary_helper";
    const IS_EXTENSION = typeof chrome !== "undefined" && Boolean(chrome.runtime?.connectNative);
    const TRUE_VALUES = new Set(["y", "yes", "true", "1", "o", "x", "v", "○", "✓"]);
    const LIST_LIMIT = 100;

    const $ = id => document.getElementById(id);
    const ui = {
      reload: $("reload"), helper: $("helper"), setup: $("setup"), copyJson: $("copyJson"),
      setupCmd: $("setupCmd"), openSetup: $("openSetup"), checks: $("checks"),
      search: $("search"), count: $("count"), problems: $("problems"),
      body: $("body"), register: $("register"), changes: $("changes"), status: $("status"),
      grid: $("grid"), newWord: $("newWord"), newMeaning: $("newMeaning"),
      newExact: $("newExact"), addTerm: $("addTerm"),
      firstPage: $("firstPage"), prevPage: $("prevPage"), nextPage: $("nextPage"),
      lastPage: $("lastPage"), pageInfo: $("pageInfo"), pageSize: $("pageSize")
    };

    // rows: [{ id, word, meaning, exact }]. Edits change these objects directly.
    let rows = [];
    // snapshot: word → { meaning, exact } as loaded from the branch.
    let snapshot = new Map();
    // helper: { login, canPush } when tools/dictionary-helper.js is running, else null.
    let helper = null;
    // checks: { git, gh, ghAuth } from the last /health answer, or null when the helper is off.
    let lastChecks = null;
    // True when the helper is not installed (native messaging host not found).
    let helperMissing = false;
    // raw.githubusercontent.com serves the script as text, which irm reads as a string.
    const SETUP_COMMAND = "irm https://raw.githubusercontent.com/JaceDashS/udemy-quiz-translator/main/tools/setup.ps1 | iex";
    let nextId = 1;
    let query = "";
    let sort = { key: null, dir: 1 };
    // Pagination: `page` is 1-based; `pages` and `matched` are set by render().
    let page = 1;
    let pageSize = 100;
    let pages = 1;
    let matched = 0;

    function newRow(word = "", meaning = "", exact = false) {
      return { id: nextId++, word, meaning, exact };
    }

    function toRows(terms) {
      return terms.map(t => newRow(String(t.word || ""), t.meaning || "", t.exact === true));
    }

    function snapshotOf(list) {
      const map = new Map();
      for (const r of list) {
        const word = r.word.trim();
        if (word && !map.has(word)) map.set(word, { meaning: r.meaning.trim(), exact: r.exact });
      }
      return map;
    }

    function wordCounts() {
      const counts = new Map();
      for (const r of rows) {
        const word = r.word.trim();
        if (word) counts.set(word, (counts.get(word) || 0) + 1);
      }
      return counts;
    }

    function changes() {
      const seen = new Set();
      const added = [];
      const changed = [];
      for (const r of rows) {
        const word = r.word.trim();
        if (!word || seen.has(word)) continue;
        seen.add(word);
        if (!snapshot.has(word)) {
          added.push(word);
        } else {
          const old = snapshot.get(word);
          if (old.meaning !== r.meaning.trim() || old.exact !== r.exact) changed.push(word);
        }
      }
      const removed = [...snapshot.keys()].filter(word => !seen.has(word));
      return { added, changed, removed };
    }

    // Returns a message when the rows cannot be submitted yet.
    function problems() {
      const empty = rows.filter(r => !r.word.trim()).length;
      if (empty) return `단어가 비어 있는 행이 ${empty}개 있습니다. 채우거나 삭제하세요.`;

      const counts = wordCounts();
      const dups = [...counts].filter(([, n]) => n > 1).map(([word]) => word);
      if (dups.length) return `같은 단어가 여러 행에 있습니다: ${dups.slice(0, 5).join(", ")}`;
      return null;
    }

    function say(message, kind = "") {
      ui.status.textContent = message;
      ui.status.className = `status ${kind}`;
    }

    function sayWithLink(message, url) {
      say(message, "ok");
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = " 열기";
      ui.status.append(link);
    }

    function compareRows(a, b) {
      if (sort.key === "exact") {
        if (a.exact !== b.exact) return (a.exact ? 1 : -1) * sort.dir;
        return a.word.localeCompare(b.word, "en") * sort.dir;
      }
      const left = sort.key === "meaning" ? a.meaning : a.word;
      const right = sort.key === "meaning" ? b.meaning : b.word;
      return left.localeCompare(right, "en") * sort.dir;
    }

    function cellInput(r, col) {
      const input = document.createElement("input");
      input.type = "text";
      input.className = col;
      input.dataset.col = col;
      input.value = r[col];
      input.autocomplete = "off";
      input.spellcheck = false;
      input.addEventListener("input", () => {
        r[col] = input.value;
        updateFlags();
        updateSummary();
      });
      input.addEventListener("keydown", e => onKeydown(e, input));
      input.addEventListener("paste", e => onPaste(e, r));
      return input;
    }

    function rowElement(r, number, counts) {
      const tr = document.createElement("tr");
      tr.dataset.id = r.id;

      const num = document.createElement("td");
      num.className = "rownum";
      num.textContent = number;

      const word = document.createElement("td");
      word.append(cellInput(r, "word"));

      const meaning = document.createElement("td");
      meaning.append(cellInput(r, "meaning"));

      const exact = document.createElement("td");
      exact.className = "check";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = r.exact;
      box.setAttribute("aria-label", "대소문자 구분");
      box.addEventListener("change", () => {
        r.exact = box.checked;
        updateSummary();
      });
      exact.append(box);

      const del = document.createElement("td");
      del.className = "del";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove";
      remove.textContent = "×";
      remove.setAttribute("aria-label", "행 삭제");
      remove.addEventListener("click", () => {
        rows = rows.filter(x => x !== r);
        render();
      });
      del.append(remove);

      tr.append(num, word, meaning, exact, del);
      applyFlags(tr, r, counts);
      return tr;
    }

    function applyFlags(tr, r, counts) {
      const word = r.word.trim();
      tr.classList.toggle("invalid", !word);
      tr.classList.toggle("dup", Boolean(word) && counts.get(word) > 1);
    }

    // Updates row highlighting after an edit without rebuilding the table,
    // so the cell being typed in keeps its focus.
    function updateFlags() {
      const counts = wordCounts();
      const byId = new Map(rows.map(r => [String(r.id), r]));
      for (const tr of ui.body.children) {
        const r = byId.get(tr.dataset.id);
        if (r) applyFlags(tr, r, counts);
      }
    }

    function updateHeaders() {
      for (const th of document.querySelectorAll("th.sortable")) {
        const arrow = th.querySelector(".arrow");
        const active = sort.key === th.dataset.key;
        arrow.textContent = active ? (sort.dir === 1 ? "▲" : "▼") : "";
      }
    }

    function updatePager() {
      ui.pageInfo.textContent = `${page} / ${pages} 페이지`;
      ui.firstPage.disabled = ui.prevPage.disabled = page <= 1;
      ui.nextPage.disabled = ui.lastPage.disabled = page >= pages;
    }

    // ---- Helper transport --------------------------------------------------
    // Side panel: a native messaging port. Chrome starts the helper when the port
    // opens and the helper exits when the port closes (the panel is closed).
    // GitHub Pages: HTTP to the helper started from a terminal.
    let nativePort = null;
    const pendingRequests = new Map();
    let nextRequestId = 1;

    function connectNative() {
      if (nativePort) return nativePort;
      const port = chrome.runtime.connectNative(NATIVE_HOST);
      port.onMessage.addListener(message => {
        const resolve = pendingRequests.get(message.id);
        if (resolve) {
          pendingRequests.delete(message.id);
          resolve(message);
        }
      });
      port.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError?.message || "The helper stopped.";
        const missing = error.includes("not found");
        for (const resolve of pendingRequests.values()) resolve({ ok: false, error, missing });
        pendingRequests.clear();
        nativePort = null;
      });
      nativePort = port;
      return port;
    }

    // Sends one request to the helper and resolves with its answer.
    function askHelper(request, timeoutMs = 8000) {
      if (IS_EXTENSION) {
        return new Promise(resolve => {
          const id = nextRequestId++;
          pendingRequests.set(id, resolve);
          setTimeout(() => {
            if (pendingRequests.delete(id)) resolve({ ok: false, error: "The helper did not answer." });
          }, timeoutMs);
          try {
            connectNative().postMessage({ id, ...request });
          } catch (error) {
            pendingRequests.delete(id);
            resolve({ ok: false, error: String(error.message) });
          }
        });
      }
      const path = request.type === "submit" ? "/submit" : "/health";
      const init = request.type === "submit"
        ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) }
        : { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) };
      return fetch(HELPER_URL + path, init)
        .then(response => response.json())
        .catch(() => ({ ok: false, error: "The helper is not running." }));
    }

    function renderChecks() {
      if (!lastChecks) {
        ui.checks.textContent = "PC 상태: 확인 불가 (도우미가 꺼져 있습니다)";
        return;
      }
      const mark = ok => (ok ? "✓" : "✗");
      ui.checks.textContent =
        `PC 상태 — git ${mark(lastChecks.git)} · gh ${mark(lastChecks.gh)} · gh 로그인 ${mark(lastChecks.ghAuth)}`;
    }

    function updateHelper() {
      renderChecks();
      if (!helper) {
        ui.helper.textContent = helperMissing ? "도우미 미설치" : "도우미 연결 안 됨";
        ui.helper.className = "helper off";
        ui.setup.hidden = false;
      } else {
        const role = helper.canPush ? "소유자: 바로 등록" : "외부 계정: PR로 제안";
        ui.helper.textContent = `도우미 연결됨 · ${helper.login} · ${role}`;
        ui.helper.className = "helper ok";
        ui.setup.hidden = true;
      }
    }

    function updateSummary() {
      const withMeaning = rows.filter(r => r.meaning.trim()).length;
      ui.count.textContent = `전체 ${rows.length}행 · 검색 결과 ${matched}행 · 뜻 있음 ${withMeaning}개`;

      const problem = problems();
      ui.problems.textContent = problem ? "⚠ 등록 불가" : "";
      ui.problems.title = problem || "";

      const { added, changed, removed } = changes();
      const dirty = added.length + changed.length + removed.length > 0;
      ui.changes.textContent = dirty
        ? `추가 ${added.length} · 수정 ${changed.length} · 삭제 ${removed.length}`
        : "변경 없음";

      // Owners commit directly; everyone else opens a pull request.
      ui.register.textContent = helper?.canPush ? "등록" : "PR 제안";
      ui.register.disabled = !helper || !dirty || Boolean(problem);
    }

    function render() {
      const counts = wordCounts();
      const numbers = new Map(rows.map((r, i) => [r.id, i + 1]));

      let view = rows;
      const q = query.trim().toLowerCase();
      if (q) {
        view = view.filter(r =>
          r.word.toLowerCase().includes(q) || r.meaning.toLowerCase().includes(q)
        );
      }
      if (sort.key) view = [...view].sort(compareRows);

      matched = view.length;
      pages = Math.max(1, Math.ceil(matched / pageSize));
      page = Math.min(Math.max(1, page), pages);
      const start = (page - 1) * pageSize;

      const fragment = document.createDocumentFragment();
      for (const r of view.slice(start, start + pageSize)) {
        fragment.append(rowElement(r, numbers.get(r.id), counts));
      }
      ui.body.replaceChildren(fragment);
      updatePager();

      updateHeaders();
      updateSummary();
    }

    // Enter moves to the same column in the next row (spreadsheet behavior).
    function onKeydown(event, input) {
      if (event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      const next = input.closest("tr").nextElementSibling;
      next?.querySelector(`input[data-col="${input.dataset.col}"]`)?.focus();
    }

    // Pasting several spreadsheet rows inserts them after the current row.
    function onPaste(event, r) {
      const text = event.clipboardData.getData("text/plain");
      if (!/[\t\n\r]/.test(text)) return;
      event.preventDefault();

      const parsed = text
        .split(/\r?\n/)
        .filter(line => line.trim())
        .map(line => {
          const [word = "", meaning = "", exact = ""] = line.split("\t");
          return newRow(word.trim(), meaning.trim(), TRUE_VALUES.has(exact.trim().toLowerCase()));
        });
      if (!parsed.length) return;

      const index = rows.indexOf(r);
      const emptyCurrent = !r.word.trim() && !r.meaning.trim() && !r.exact;
      rows.splice(emptyCurrent ? index : index + 1, emptyCurrent ? 1 : 0, ...parsed);
      query = "";
      ui.search.value = "";
      render();
      say(`${parsed.length}행을 붙여넣었습니다.`);
    }

    // Adds a term from the top form. Only the word is required; the new row
    // goes to the top of the table so it is visible right away.
    function addTerm() {
      const word = ui.newWord.value.trim();
      const meaning = ui.newMeaning.value.trim();
      if (!word) {
        say("단어를 입력하세요. 뜻은 비워도 됩니다.", "error");
        ui.newWord.focus();
        return;
      }
      if (word.length > 200 || meaning.length > 200) {
        say("단어와 뜻은 각각 200자 이하여야 합니다.", "error");
        return;
      }
      if (rows.some(r => r.word.trim() === word)) {
        say(`이미 있는 단어입니다: ${word}`, "error");
        ui.newWord.select();
        return;
      }

      rows.unshift(newRow(word, meaning, ui.newExact.checked));
      page = 1;
      ui.newWord.value = "";
      ui.newMeaning.value = "";
      ui.newExact.checked = false;
      query = "";
      ui.search.value = "";
      sort = { key: null, dir: 1 };
      render();
      ui.grid.scrollTop = 0;
      say(`추가했습니다: ${word}`, "ok");
      ui.newWord.focus();
    }

    // The whole dictionary.json content for the current rows (version 2).
    function buildFile() {
      const terms = rows
        .map(r => {
          const term = { word: r.word.trim() };
          if (r.meaning.trim()) term.meaning = r.meaning.trim();
          if (r.exact) term.exact = true;
          return term;
        })
        .sort((a, b) => a.word.localeCompare(b.word, "en"));
      return JSON.stringify({ version: 2, terms }, null, 2) + "\n";
    }

    // Reads the current dictionary.json from the branch (public, no token needed).
    async function load() {
      say("불러오는 중...");
      try {
        const response = await fetch(RAW_URL, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (data.version !== 2 || !Array.isArray(data.terms)) {
          throw new Error("dictionary.json이 버전 2 형식이 아닙니다.");
        }

        rows = toRows(data.terms);
        page = 1;
        snapshot = snapshotOf(rows);
        query = "";
        ui.search.value = "";
        say(`${rows.length}행을 불러왔습니다.`, "ok");
      } catch (error) {
        say(`불러오기 실패: ${error.message}`, "error");
      }
      render();
    }

    // Asks the local helper who is logged in and whether that account can push.
    async function checkHelper() {
      const data = await askHelper({ type: "health" });
      lastChecks = data.checks || null;
      helper = data.ok ? { login: data.login, canPush: data.canPush } : null;
      helperMissing = Boolean(data.missing);
      if (!data.ok) console.warn("[Dictionary Editor]", data.error, data.detail || "");
      updateHelper();
      updateSummary();
    }

    // Sends the full file and the commit message to the helper. The helper decides
    // between a direct commit (owner) and a pull request (everyone else).
    async function submit() {
      const problem = problems();
      if (problem) {
        say(problem, "error");
        return;
      }
      if (!helper) {
        say("도우미가 연결되어 있지 않습니다. 위 안내를 따라 실행하세요.", "error");
        return;
      }

      const { added, changed, removed } = changes();
      const list = (verb, words) => words.slice(0, LIST_LIMIT).map(w => `- ${verb} "${w}"`)
        .concat(words.length > LIST_LIMIT ? [`- ${verb} ${words.length - LIST_LIMIT} more`] : []);
      const message = [
        "[chore] Update dictionary terms",
        "",
        ...list("Add", added),
        ...list("Change", changed),
        ...list("Remove", removed)
      ].join("\n");

      ui.register.disabled = true;
      say(helper.canPush ? "등록 중..." : "PR을 만드는 중...");
      try {
        const data = await askHelper({ type: "submit", message, content: buildFile() }, 120000);
        if (!data.ok) throw new Error(data.error || "The helper failed.");

        if (data.mode === "direct") {
          snapshot = snapshotOf(rows);
          say(data.changed ? `등록했습니다(커밋 ${data.commit}). 다음 번역 페이지 로드부터 반영됩니다.` : "변경된 내용이 없습니다.", "ok");
        } else if (data.changed) {
          snapshot = snapshotOf(rows);
          sayWithLink("PR을 열었습니다. 소유자가 확인하면 반영됩니다.", data.url);
        } else {
          say("변경된 내용이 없습니다.", "ok");
        }
      } catch (error) {
        say(`실패: ${error.message}`, "error");
      } finally {
        updateSummary();
      }
    }

    ui.reload.addEventListener("click", () => {
      if (isDirty() && !confirm("저장하지 않은 변경이 사라집니다. 계속할까요?")) return;
      load();
    });
    ui.openSetup.addEventListener("click", async () => {
      if (!IS_EXTENSION) {
        say("PowerShell 열기는 확장 프로그램 사이드 패널에서 사용할 수 있습니다.", "error");
        return;
      }
      const data = await askHelper({ type: "openSetup" });
      if (data.ok) {
        say("PowerShell 창을 열었습니다. 창의 안내를 따라 진행하세요.", "ok");
      } else {
        say("도우미가 아직 등록되지 않았습니다. 저장소 루트의 setup.cmd를 한 번 더블클릭하세요.", "error");
      }
    });
    ui.setupCmd.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(SETUP_COMMAND);
        say("준비 명령을 복사했습니다. PowerShell 창에 붙여넣고 Enter를 누르세요. 설치 여부는 창에서 물어봅니다.", "ok");
      } catch (_) {
        say(`복사하지 못했습니다. 직접 입력하세요: ${SETUP_COMMAND}`, "error");
      }
    });
    ui.copyJson.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(buildFile());
        say("JSON을 복사했습니다.", "ok");
      } catch (_) {
        say("복사하지 못했습니다.", "error");
      }
    });
    ui.search.addEventListener("input", () => {
      query = ui.search.value;
      page = 1;
      render();
    });
    ui.firstPage.addEventListener("click", () => { page = 1; render(); });
    ui.prevPage.addEventListener("click", () => { page -= 1; render(); });
    ui.nextPage.addEventListener("click", () => { page += 1; render(); });
    ui.lastPage.addEventListener("click", () => { page = pages; render(); });
    ui.pageSize.addEventListener("change", () => {
      pageSize = Number(ui.pageSize.value);
      page = 1;
      render();
    });
    ui.addTerm.addEventListener("click", addTerm);
    for (const input of [ui.newWord, ui.newMeaning]) {
      input.addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.isComposing) {
          e.preventDefault();
          addTerm();
        }
      });
    }
    ui.register.addEventListener("click", submit);
    for (const th of document.querySelectorAll("th.sortable")) {
      th.addEventListener("click", () => {
        const key = th.dataset.key;
        sort = sort.key === key ? { key, dir: -sort.dir } : { key, dir: 1 };
        page = 1;
        render();
      });
    }

    function isDirty() {
      const { added, changed, removed } = changes();
      return added.length + changed.length + removed.length > 0;
    }

    window.addEventListener("beforeunload", e => {
      if (isDirty()) e.preventDefault();
    });

    // Closing the side panel disconnects the port, which stops the helper.
    window.addEventListener("pagehide", () => {
      nativePort?.disconnect();
      nativePort = null;
    });

    load();
    checkHelper();
  