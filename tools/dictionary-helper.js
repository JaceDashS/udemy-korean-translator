#!/usr/bin/env node
/*
 * Dictionary helper: a local server for the dictionary editor.
 *
 * The editor sends the full dictionary.json to 127.0.0.1. The helper uses the
 * git and gh (GitHub CLI) logins already on this PC, so no token is stored in
 * the browser or on a server.
 * - Repository owner (push permission): commits to the `dictionary` branch.
 * - Anyone else: forks the repository, commits to a new branch, and opens a
 *   pull request to the `dictionary` branch.
 *
 * Requires: Node.js 18+, git, and gh (run `gh auth login` once).
 * Start: node tools/dictionary-helper.js
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
const HOST = "127.0.0.1";
const PORT = Number(process.env.DICTIONARY_HELPER_PORT || 8787);
// Only the editor page may call the helper.
const ALLOWED_ORIGIN = "https://jacedashs.github.io";
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const MAX_WORD_LENGTH = 200;
const WORK_DIR = path.join(os.homedir(), ".udemy-dictionary-helper");

class HttpError extends Error {
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
    throw new HttpError(400, "dictionary.json is not valid JSON.");
  }
  if (data?.version !== 2 || !Array.isArray(data.terms)) {
    throw new HttpError(400, "dictionary.json must be version 2 with a terms array.");
  }
  for (const row of data.terms) {
    const ok =
      typeof row?.word === "string" &&
      row.word.trim().length > 0 &&
      row.word.length <= MAX_WORD_LENGTH &&
      (row.meaning === undefined || (typeof row.meaning === "string" && row.meaning.length <= MAX_WORD_LENGTH)) &&
      (row.exact === undefined || typeof row.exact === "boolean");
    if (!ok) throw new HttpError(400, `Invalid row: ${JSON.stringify(row).slice(0, 120)}`);
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, "Request is too large."));
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

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && origin !== ALLOWED_ORIGIN) {
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
      try {
        const { login, canPush } = await exclusive(whoAmI);
        send(res, 200, { ok: true, login, canPush, repo: REPO });
      } catch (error) {
        send(res, 200, { ok: false, error: "gh is not ready. Run `gh auth login`.", detail: String(error.message) });
      }
      return;
    }

    if (req.method === "POST" && req.url === "/submit") {
      const body = JSON.parse(await readBody(req));
      const content = String(body.content || "");
      const message = String(body.message || "").trim();
      if (!message) throw new HttpError(400, "A commit message is required.");
      if (message.length > 4000) throw new HttpError(400, "The commit message is too long.");
      const count = checkContent(content);

      const result = await exclusive(async () => {
        const { login, canPush } = await whoAmI();
        return canPush
          ? submitDirect(content, message)
          : submitProposal(content, message, login);
      });
      console.log(`[${new Date().toISOString()}] ${result.mode} ${result.changed ? "changed" : "no change"} (${count} terms)`);
      send(res, 200, { ok: true, ...result });
      return;
    }

    send(res, 404, { error: "Not found." });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const detail = error.stderr ? String(error.stderr).trim() : error.message;
    console.error(`[${new Date().toISOString()}] error: ${detail}`);
    send(res, status, { ok: false, error: detail });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Dictionary helper listening on http://${HOST}:${PORT}`);
  console.log("Keep this window open while using the editor. Press Ctrl+C to stop.");
});
