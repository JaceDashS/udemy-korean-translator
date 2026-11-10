"use strict";

// The conflict window: lists each conflicted term with both values and sends
// the user's pick per term back to the editor (editor/conflicts.js).

const body = document.getElementById("body");

function describe(term) {
  const span = document.createElement("span");
  if (!term) {
    span.className = "gone";
    span.textContent = "(삭제됨)";
    return span;
  }
  const parts = [term.meaning ? `뜻: ${term.meaning}` : "뜻 없음 (영어 그대로)"];
  if (term.exact) parts.push("대소문자 구분");
  span.textContent = parts.join(" · ");
  return span;
}

function option(item, side, term, checked) {
  const td = document.createElement("td");
  const label = document.createElement("label");
  const radio = document.createElement("input");
  radio.type = "radio";
  radio.name = item.path;
  radio.value = side;
  radio.checked = checked;
  label.append(radio, " ", describe(term));
  td.append(label);
  return td;
}

function choices() {
  const out = {};
  for (const radio of body.querySelectorAll("input:checked")) out[radio.name] = radio.value;
  return out;
}

function pickAll(side) {
  for (const radio of body.querySelectorAll(`input[value="${side}"]`)) radio.checked = true;
}

async function init() {
  const data = await chrome.runtime.sendMessage({ target: "conflicts", action: "get" });
  if (!data?.items) {
    window.close();
    return;
  }
  if (data.title) document.getElementById("intro").textContent = data.title;
  for (const item of data.items) {
    const tr = document.createElement("tr");
    const word = document.createElement("td");
    word.textContent = item.word;
    tr.append(word, option(item, "mine", item.mine, true), option(item, "current", item.current, false));
    body.append(tr);
  }
}

document.getElementById("allMine").addEventListener("click", () => pickAll("mine"));
document.getElementById("allCurrent").addEventListener("click", () => pickAll("current"));
document.getElementById("cancel").addEventListener("click", () => window.close());
document.getElementById("done").addEventListener("click", () => {
  chrome.runtime.sendMessage({ target: "conflicts", action: "done", choices: choices() });
});

init();
