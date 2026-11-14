/* The spreadsheet editor saves local items through the trusted service worker. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const IS_EXTENSION = typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
  const TermFiles = globalThis.__dictionaryTermFiles;
  let model;
  let page = 1;
  let sorting = { key: "word", direction: 1 };
  let refreshing = false;
  let again = false;
  let editQueue = Promise.resolve();
  let conflictSignature = "";

  function say(text, error = false) { $("status").textContent = text; $("status").className = `status ${error ? "error" : "ok"}`; }
  async function send(action, data = {}) {
    if (!IS_EXTENSION) throw new Error("단어장은 확장 프로그램 안에서 열어주세요.");
    const result = await chrome.runtime.sendMessage({ target: "dictionary", action, ...data });
    if (!result?.ok) throw new Error(result?.error || "서버와 연결하지 못했습니다. 로컬 데이터는 유지됩니다.");
    return result;
  }

  function button(label, run) {
    const element = document.createElement("button");
    element.type = "button";
    element.textContent = label;
    element.addEventListener("click", () => perform(run));
    return element;
  }

  async function perform(run) {
    try { await run(); await refresh(); }
    catch (error) { say(error.message, true); }
  }

  function status() {
    if (!model) return;
    const { state, user, canUpload } = model;
    $("account").textContent = user ? `${user.username} · ${canUpload ? "등록 권한 있음" : "서버 등록 권한 없음"}` : "서버 업로드는 로그인 후 가능합니다. 로컬 편집은 로그인 없이 가능합니다.";
    $("loginForm").hidden = !!user;
    $("logout").hidden = !user;
    $("autoUpload").checked = state.autoUpload;
    $("register").disabled = !state.initialized || !canUpload;
    $("addTerm").disabled = false;
    $("login").textContent = model.loginPending ? '로그인 창 다시 열기' : '사이트 계정으로 로그인';
    $("syncInfo").textContent = state.initialized ? `마지막 수신 ${state.downloadedAt ? new Date(state.downloadedAt).toLocaleString() : ""}` : "최초 서버 동기화가 필요합니다.";
    const pending = state.drafts.filter(draft => draft.mode === "pending").length;
    $("changes").textContent = `업로드 대기 ${pending}개 · 로컬 저장됨`;
    conflicts();
  }

  function conflicts() {
    const signature = JSON.stringify({ drafts: model.state.drafts.filter(draft => draft.mode !== "pending"), user: model.user?.id, canUpload: model.canUpload });
    if (signature === conflictSignature) return;
    conflictSignature = signature;
    const list = model.state.drafts.filter(draft => draft.mode === "conflict");
    const openWords = new Set([...$("conflicts").querySelectorAll("details[open]")].map(element => element.dataset.word));
    $("conflictCount").textContent = list.length;
    $("conflicts").replaceChildren();
    for (const draft of list) {
      const section = document.createElement("details");
      section.dataset.word = draft.word;
      section.open = openWords.has(draft.word);
      const summary = document.createElement("summary");
      summary.textContent = draft.word;
      const values = document.createElement("pre");
      values.style.whiteSpace = "pre-wrap";
      values.textContent = `내 값: ${JSON.stringify(draft.value)}\n서버 값: ${JSON.stringify(draft.conflict.server.value)}`;
      if (draft.conflict.server.updatedBy) values.textContent += `\n서버 수정자: ${draft.conflict.server.updatedBy.username}`;
      if (draft.conflict.server.updatedAt) values.textContent += `\n서버 수정 시각: ${new Date(draft.conflict.server.updatedAt).toLocaleString()}`;
      section.append(summary, values);
      if (draft.conflict.ownerId === model.user?.id && model.canUpload) {
        for (const [choice, label] of [["mine", "내 번역 업로드"], ["server", "서버 번역 사용"], ["local", "로컬만 유지"], ["later", "나중에 결정"]]) {
          section.append(button(label, () => send("resolve", { word: draft.word, conflictId: draft.conflict.id, choice })));
        }
      } else section.append("이 충돌을 발생시킨 계정으로 로그인해 해결하세요.");
      $("conflicts").append(section);
    }
    $("localOnly").replaceChildren();
    for (const draft of model.state.drafts.filter(row => row.mode === "local")) {
      const row = document.createElement("p");
      row.append(draft.word + " ", button("공유 대상으로 변경", () => send("queueLocal", { word: draft.word })));
      $("localOnly").append(row);
    }
  }

  async function refresh() {
    if (refreshing) { again = true; return; }
    refreshing = true;
    try {
      do {
        again = false;
        model = await send("view");
        status();
        if (!$("body").contains(document.activeElement)) render();
      } while (again);
    } finally { refreshing = false; }
  }

  function save(oldWord, raw) {
    editQueue = editQueue.catch(() => {}).then(async () => {
      const value = raw === null ? null : TermFiles.normalizeTerm(raw);
      if (value) {
        const error = TermFiles.checkTerm(value);
        if (error) throw new Error(error);
        if (value.word !== oldWord && model.terms.some(term => term.word === value.word)) throw new Error("같은 단어가 이미 있습니다.");
      }
      // Persist the new word before a rename removes the old local entry.
      if (value) await send("edit", { word: value.word, value });
      if (!value || value.word !== oldWord) await send("edit", { word: oldWord, value: null });
      say("로컬에 저장했습니다.");
    });
    return editQueue;
  }

  function cell(term, key) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = key;
    input.value = term[key] || "";
    input.maxLength = 200;
    input.autocomplete = "off";
    input.setAttribute("aria-label", `${term.word} ${key === "word" ? "단어" : "뜻"}`);
    input.addEventListener("change", () => {
      const oldWord = term.word;
      const next = { ...term, [key]: input.value.trim() };
      Object.assign(term, next);
      void perform(() => save(oldWord, next));
    });
    input.addEventListener("keydown", event => {
      if (event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      input.blur();
      const row = input.closest("tr").nextElementSibling;
      row?.querySelector(`input.${key}`)?.focus();
    });
    input.addEventListener("paste", event => {
      const text = event.clipboardData.getData("text/plain");
      if (!/[\t\n]/.test(text)) return;
      event.preventDefault();
      void perform(() => paste(text));
    });
    return input;
  }

  function row(term, number) {
    const element = document.createElement("tr");
    const num = document.createElement("td"); num.className = "rownum"; num.textContent = number;
    const word = document.createElement("td"); word.append(cell(term, "word"));
    const meaning = document.createElement("td"); meaning.append(cell(term, "meaning"));
    const exact = document.createElement("td"); exact.className = "check";
    const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = term.exact === true;
    checkbox.setAttribute("aria-label", `${term.word} 대소문자 구분`);
    checkbox.addEventListener("change", () => { term.exact = checkbox.checked; void perform(() => save(term.word, { ...term })); });
    exact.append(checkbox);
    const remove = document.createElement("td"); remove.append(button("삭제", () => save(term.word, null)));
    const draft = model.state.drafts.find(entry => entry.word === term.word);
    if (draft?.conflict) {
      element.title = "아래 충돌 목록에서 먼저 해결하세요.";
      for (const input of [word.querySelector("input"), meaning.querySelector("input"), checkbox, remove.querySelector("button")]) input.disabled = true;
    }
    element.append(num, word, meaning, exact, remove);
    return element;
  }

  function render() {
    if (!model) return;
    const query = $("search").value.toLocaleLowerCase();
    const terms = model.terms.filter(term => `${term.word} ${term.meaning || ""}`.toLocaleLowerCase().includes(query));
    terms.sort((a, b) => String(a[sorting.key] || "").localeCompare(String(b[sorting.key] || "")) * sorting.direction);
    const size = Number($("pageSize").value);
    const pages = Math.max(1, Math.ceil(terms.length / size));
    page = Math.max(1, Math.min(page, pages));
    $("count").textContent = `${terms.length} / ${model.terms.length}개`;
    $("pageInfo").textContent = `${page} / ${pages} 페이지`;
    $("firstPage").disabled = $("prevPage").disabled = page === 1;
    $("lastPage").disabled = $("nextPage").disabled = page === pages;
    $("body").replaceChildren(...terms.slice((page - 1) * size, page * size).map((term, index) => row({ ...term }, (page - 1) * size + index + 1)));
    for (const header of document.querySelectorAll("th.sortable")) header.querySelector(".arrow").textContent = header.dataset.key === sorting.key ? (sorting.direction === 1 ? "▲" : "▼") : "";
  }

  async function paste(text) {
    const entries = text.trim().split(/\r?\n/).filter(Boolean).map(line => {
      const [word, meaning = "", exact = ""] = line.split("\t");
      return TermFiles.normalizeTerm({ word, meaning, exact: /^(y|yes|true|1|o|x|v|○|✓)$/i.test(exact.trim()) });
    });
    if (entries.some(term => TermFiles.checkTerm(term)) || new Set(entries.map(term => term.word)).size !== entries.length ||
      entries.some(term => model.terms.some(old => old.word === term.word))) throw new Error("붙여넣기에 중복되거나 올바르지 않은 단어가 있습니다.");
    for (const entry of entries) await save(entry.word, entry);
    page = 1;
  }

  $("login").addEventListener("click", () => perform(() => send("login")));
  $("logout").addEventListener("click", () => perform(() => send("logout")));
  $("reload").addEventListener("click", () => perform(() => send("download")));
  $("register").addEventListener("click", () => perform(() => send("upload")));
  $("autoUpload").addEventListener("change", () => perform(() => send("automatic", { enabled: $("autoUpload").checked })));
  $("addTerm").addEventListener("click", () => perform(async () => {
    const value = { word: $("newWord").value.trim(), meaning: $("newMeaning").value.trim(), exact: $("newExact").checked };
    if (!value.word || model.terms.some(term => term.word === value.word)) throw new Error("빈 단어 또는 중복된 단어입니다.");
    await save(value.word, value);
    $("newWord").value = $("newMeaning").value = "";
    $("newExact").checked = false;
    page = 1;
  }));
  $("search").addEventListener("input", () => { page = 1; render(); });
  $("pageSize").addEventListener("change", () => { page = 1; render(); });
  for (const [name, update] of [["firstPage", () => 1], ["prevPage", () => page - 1], ["nextPage", () => page + 1], ["lastPage", () => Number.MAX_SAFE_INTEGER]]) {
    $(name).addEventListener("click", () => { page = update(); render(); });
  }
  for (const header of document.querySelectorAll("th.sortable")) header.addEventListener("click", () => {
    sorting = { key: header.dataset.key, direction: sorting.key === header.dataset.key ? -sorting.direction : 1 };
    render();
  });
  $("body").addEventListener("focusout", () => setTimeout(() => { if (!$("body").contains(document.activeElement)) render(); }, 0));
  if (IS_EXTENSION) chrome.storage.onChanged.addListener(() => { void refresh().catch(error => say(error.message, true)); });
  window.addEventListener("online", () => perform(() => send("download")));
  void perform(async () => { await refresh(); try { await send("download"); } catch (error) { say(error.message, true); } });
})();
