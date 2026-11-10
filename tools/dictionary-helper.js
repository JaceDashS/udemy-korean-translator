#!/usr/bin/env node
/*
 * Dictionary helper: saves dictionary changes with the git and gh (GitHub CLI)
 * logins already on this PC. No token is stored in the browser or on a server.
 * - Repository owner (push permission): commits to the `dictionary` branch.
 * - Anyone else: forks the repository, commits to a new branch, and opens a
 *   pull request to the `dictionary` branch.
 *
 * Two ways to run it:
 * - Chrome side panel: Chrome starts it as a native messaging host when the
 *   panel connects, and it exits when the panel disconnects.
 * - Terminal (`node tools/dictionary-helper.js`): a local HTTP server on
 *   127.0.0.1 for the GitHub Pages editor. Stop with Ctrl+C.
 *
 * Requires: Node.js 18+, git, and gh (run `gh auth login` once).
 */
"use strict";

const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const run = promisify(execFile);

const REPO = "JaceDashS/udemy-quiz-translator";
const REPO_NAME = "udemy-quiz-translator";
const BRANCH = "dictionary";
const FILE = "dictionary.json";
const HTTP_HOST = "127.0.0.1";
const HTTP_PORT = Number(process.env.DICTIONARY_HELPER_PORT || 8787);
// The GitHub Pages editor and the extension's side panel (fixed ID from manifest.json).
const ALLOWED_ORIGINS = new Set([
  "https://jacedashs.github.io",
  "chrome-extension://mmmljckioegeobbebbmildgebfjfbbdo"
]);
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const MAX_WORD_LENGTH = 200;
const WORK_DIR = path.join(os.homedir(), ".udemy-dictionary-helper");

// In native messaging mode stdout carries the protocol, so logs go to stderr.
const log = text => process.stderr.write(`[${new Date().toISOString()}] ${text}\n`);

class HelperError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Commands run without a shell, with arguments passed as an array.
async function command(cmd, args, cwd) {
  const { stdout } = await run(cmd, args, { cwd, maxBuffer: 16 * 1024 * 1024 });
  return stdout.trim();
}

const git = (args, cwd) => command("git", args, cwd);
const gh = (args, cwd) => command("gh", args, cwd);

// Rejects anything that is not a valid version 2 dictionary file.
function checkContent(content) {
  let data;
  try {
    data = JSON.parse(content);
  } catch (_) {
    throw new HelperError(400, "dictionary.json is not valid JSON.");
  }
  if (data?.version !== 2 || !Array.isArray(data.terms)) {
    throw new HelperError(400, "dictionary.json must be version 2 with a terms array.");
  }
  for (const row of data.terms) {
    const ok =
      typeof row?.word === "string" &&
      row.word.trim().length > 0 &&
      row.word.length <= MAX_WORD_LENGTH &&
      (row.meaning === undefined || (typeof row.meaning === "string" && row.meaning.length <= MAX_WORD_LENGTH)) &&
      (row.exact === undefined || typeof row.exact === "boolean");
    if (!ok) throw new HelperError(400, `Invalid row: ${JSON.stringify(row).slice(0, 120)}`);
  }
  return data.terms.length;
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch (_) {
    return false;
  }
}

// Whether a command runs successfully (used for the setup checklist).
async function succeeds(cmd, args) {
  try {
    await command(cmd, args);
    return true;
  } catch (_) {
    return false;
  }
}

// What the editor shows in its setup checklist.
async function setupChecks() {
  const hasGit = await succeeds("git", ["--version"]);
  const hasGh = await succeeds("gh", ["--version"]);
  const ghAuth = hasGh && (await succeeds("gh", ["auth", "status"]));
  return { git: hasGit, gh: hasGh, ghAuth };
}

// Who is logged in to gh, and whether that account can push to the repository.
async function whoAmI() {
  const login = await gh(["api", "user", "--jq", ".login"]);
  const push = await gh(["api", `repos/${REPO}`, "--jq", ".permissions.push"]);
  return { login, canPush: push === "true" };
}

// Writes the file, commits it when it changed, and returns false if nothing changed.
async function commitFile(dir, content, message) {
  await fs.writeFile(path.join(dir, FILE), content, "utf8");
  await git(["add", FILE], dir);
  const status = await git(["status", "--porcelain", FILE], dir);
  if (!status) return false;
  await git(["commit", "-m", message], dir);
  return true;
}

// Owner: commit straight to the dictionary branch of the main repository.
async function submitDirect(content, message) {
  const dir = path.join(WORK_DIR, "owner", REPO_NAME);
  if (!(await exists(path.join(dir, ".git")))) {
    await fs.mkdir(path.dirname(dir), { recursive: true });
    await gh(["repo", "clone", REPO, dir], undefined);
  }
  await git(["fetch", "origin", BRANCH], dir);
  await git(["checkout", "-B", BRANCH, `origin/${BRANCH}`], dir);

  const committed = await commitFile(dir, content, message);
  if (!committed) return { mode: "direct", changed: false };

  await git(["push", "origin", `HEAD:${BRANCH}`], dir);
  const sha = await git(["rev-parse", "--short", "HEAD"], dir);
  return { mode: "direct", changed: true, commit: sha };
}

// Everyone else: fork, commit to a new branch on the fork, open a pull request.
async function submitProposal(content, message, login) {
  try {
    await gh(["repo", "fork", REPO, "--clone=false"]);
  } catch (error) {
    // An existing fork is not an error.
    if (!String(error.stderr || error.message).includes("already exists")) throw error;
  }

  const dir = path.join(WORK_DIR, "fork", REPO_NAME);
  if (!(await exists(path.join(dir, ".git")))) {
    await fs.mkdir(path.dirname(dir), { recursive: true });
    await gh(["repo", "clone", `${login}/${REPO_NAME}`, dir], undefined);
  }

  const remotes = await git(["remote"], dir);
  if (!remotes.split("\n").includes("upstream")) {
    await git(["remote", "add", "upstream", `https://github.com/${REPO}.git`], dir);
  }
  await git(["fetch", "upstream", BRANCH], dir);

  const branch = `dictionary-update-${Date.now()}`;
  await git(["checkout", "-B", branch, `upstream/${BRANCH}`], dir);

  const committed = await commitFile(dir, content, message);
  if (!committed) return { mode: "proposal", changed: false };

  await git(["push", "-u", "origin", branch], dir);
  const url = await gh(
    [
      "pr", "create",
      "--repo", REPO,
      "--base", BRANCH,
      "--head", `${login}:${branch}`,
      "--title", message.split("\n")[0],
      "--body", "Submitted from the dictionary editor. Please review the changed terms."
    ],
    dir
  );
  return { mode: "proposal", changed: true, url };
}

// One request at a time: git operations on the same work directory must not overlap.
let queue = Promise.resolve();
function exclusive(task) {
  const result = queue.then(task, task);
  queue = result.catch(() => {});
  return result;
}

// Shared by both transports. Returns the answer body or throws a HelperError.
async function handle(request) {
  if (request.type === "health") {
    const checks = await setupChecks();
    try {
      const { login, canPush } = await exclusive(whoAmI);
      return { ok: true, login, canPush, repo: REPO, checks };
    } catch (error) {
      return {
        ok: false,
        error: "gh is not ready. Run `gh auth login`.",
        detail: String(error.message),
        checks
      };
    }
  }

  if (request.type === "submit") {
    const content = String(request.content || "");
    const message = String(request.message || "").trim();
    if (!message) throw new HelperError(400, "A commit message is required.");
    if (message.length > 4000) throw new HelperError(400, "The commit message is too long.");
    const count = checkContent(content);

    const result = await exclusive(async () => {
      const { login, canPush } = await whoAmI();
      return canPush ? submitDirect(content, message) : submitProposal(content, message, login);
    });
    log(`${result.mode} ${result.changed ? "changed" : "no change"} (${count} terms)`);
    return { ok: true, ...result };
  }

  throw new HelperError(400, "Unknown request.");
}

function errorDetail(error) {
  return error.stderr ? String(error.stderr).trim() : error.message;
}

// ---- Native messaging (Chrome side panel) -------------------------------

// Chrome sends each message as a 4-byte little-endian length followed by JSON.
function startNativeMessaging() {
  const sendNative = object => {
    const body = Buffer.from(JSON.stringify(object), "utf8");
    const header = Buffer.alloc(4);
    header.writeUInt32LE(body.length, 0);
    process.stdout.write(Buffer.concat([header, body]));
  };

  let buffered = Buffer.alloc(0);
  process.stdin.on("data", chunk => {
    buffered = Buffer.concat([buffered, chunk]);
    while (buffered.length >= 4) {
      const length = buffered.readUInt32LE(0);
      if (buffered.length < 4 + length) break;
      const message = JSON.parse(buffered.subarray(4, 4 + length).toString("utf8"));
      buffered = buffered.subarray(4 + length);

      const { id, ...request } = message;
      handle(request)
        .then(body => sendNative({ id, ...body }))
        .catch(error => {
          const status = error instanceof HelperError ? error.status : 500;
          log(`error: ${errorDetail(error)}`);
          sendNative({ id, ok: false, status, error: errorDetail(error) });
        });
    }
  });

  // The side panel disconnected: Chrome closes stdin, so the helper exits too.
  process.stdin.on("end", () => process.exit(0));
}

// ---- Local HTTP server (GitHub Pages editor, started from a terminal) ----

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HelperError(413, "Request is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function startHttpServer() {
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      send(res, 403, { error: "Origin not allowed." });
      return;
    }
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    // Lets an https page reach a local server (Chrome Private Network Access).
    res.setHeader("Access-Control-Allow-Private-Network", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if (req.method === "GET" && req.url === "/health") {
        send(res, 200, await handle({ type: "health" }));
        return;
      }
      if (req.method === "POST" && req.url === "/submit") {
        const body = JSON.parse(await readBody(req));
        send(res, 200, await handle({ type: "submit", ...body }));
        return;
      }
      send(res, 404, { error: "Not found." });
    } catch (error) {
      const status = error instanceof HelperError ? error.status : 500;
      log(`error: ${errorDetail(error)}`);
      send(res, status, { ok: false, error: errorDetail(error) });
    }
  });

  server.listen(HTTP_PORT, HTTP_HOST, () => {
    log(`Dictionary helper listening on http://${HTTP_HOST}:${HTTP_PORT}`);
    console.log("Keep this window open while using the editor. Press Ctrl+C to stop.");
  });
}

// Chrome runs the helper with piped stdin; a terminal has a TTY.
if (process.stdin.isTTY) {
  startHttpServer();
} else {
  startNativeMessaging();
}
