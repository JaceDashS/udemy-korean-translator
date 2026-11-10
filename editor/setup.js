"use strict";

// One-time registration guide, opened in a tab by the dictionary editor.
// It shows the register command and waits until the helper answers.
const SCRIPT_URL =
  "https://raw.githubusercontent.com/JaceDashS/udemy-quiz-translator/main/tools/register.ps1";
const COMMAND = `irm ${SCRIPT_URL} | iex`;
const POLL_MS = 2000;

const state = document.getElementById("state");
document.getElementById("command").textContent = COMMAND;
document.getElementById("source").href = SCRIPT_URL;

document.getElementById("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(COMMAND);
    state.textContent = "명령을 복사했습니다. PowerShell에 붙여넣고 Enter를 누르세요. 등록을 기다리는 중...";
    state.className = "state";
  } catch (_) {
    state.textContent = "복사하지 못했습니다. 위 명령을 직접 선택해 복사하세요.";
    state.className = "state error";
  }
});

// The helper bundled in the extension sets the version a registration must reach.
async function neededVersion() {
  try {
    const response = await fetch(chrome.runtime.getURL("tools/dictionary-host.ps1"), { cache: "no-store" });
    return Number(/^\$HostVersion = (\d+)/m.exec(await response.text())?.[1]) || 0;
  } catch (_) {
    return 0;
  }
}

// An old helper that is already running keeps its old code, so it is stopped
// before each check; the next ping starts the helper that is now registered.
async function registered(needed) {
  try {
    await chrome.runtime.sendMessage({ target: "helper", action: "stop" });
    const answer = await chrome.runtime.sendMessage({
      target: "helper",
      action: "request",
      request: { type: "ping" },
      timeoutMs: 20000
    });
    return Boolean(answer?.ok) && (Number(answer.version) || 0) >= needed;
  } catch (_) {
    return false;
  }
}

async function waitForRegistration() {
  const needed = await neededVersion();
  while (!(await registered(needed))) {
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
  state.textContent = "등록됐습니다. 이 탭을 닫고 사전 편집기로 돌아가세요. 편집기가 다음 단계로 이어서 진행합니다.";
  state.className = "state ok";
}

waitForRegistration();
