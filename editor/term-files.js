/*
 * Term files: one file per dictionary term under terms/ on the dictionary branch.
 * Shared by the editor (browser), the build script, and the tests (Node).
 *
 * - fileName(word): terms/<slug>-<hash>.json. The hash is the first 8 hex digits
 *   of SHA-1 over the exact word, so "SAM" and "sam" get different files even on
 *   a case-insensitive file system, and the same word always gets the same file.
 * - fileContent(term): the canonical file text (key order word, meaning, exact).
 * - blobSha(text): git's blob id, used to tell whether a file changed since load.
 * - buildDictionary(terms): the dictionary.json text the extension reads.
 */
(() => {
  "use strict";

  const DIR = "terms";
  const SLUG_LENGTH = 40;
  const MAX_LENGTH = 200;

  const encoder = new TextEncoder();

  async function sha1Hex(bytes) {
    const digest = await globalThis.crypto.subtle.digest("SHA-1", bytes);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function slugOf(word) {
    const slug = word
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, SLUG_LENGTH)
      .replace(/-+$/, "");
    return slug || "term";
  }

  async function fileName(word) {
    const hash = (await sha1Hex(encoder.encode(word))).slice(0, 8);
    return `${DIR}/${slugOf(word)}-${hash}.json`;
  }

  // Only the fields a term has, in a fixed order, so equal terms give equal files.
  function normalizeTerm(term) {
    const out = { word: term.word.trim() };
    const meaning = typeof term.meaning === "string" ? term.meaning.trim() : "";
    if (meaning) out.meaning = meaning;
    if (term.exact === true) out.exact = true;
    return out;
  }

  function fileContent(term) {
    return JSON.stringify(normalizeTerm(term), null, 2) + "\n";
  }

  async function blobSha(text) {
    const body = encoder.encode(text);
    const header = encoder.encode(`blob ${body.length}\0`);
    const all = new Uint8Array(header.length + body.length);
    all.set(header);
    all.set(body, header.length);
    return sha1Hex(all);
  }

  // Returns an error message, or null when the parsed file is a valid term.
  function checkTerm(term) {
    if (!term || typeof term !== "object" || Array.isArray(term)) return "not an object";
    const keys = Object.keys(term).filter(k => !["word", "meaning", "exact"].includes(k));
    if (keys.length) return `unknown keys: ${keys.join(", ")}`;
    if (typeof term.word !== "string" || !term.word.trim()) return "word is empty";
    if (term.word.length > MAX_LENGTH) return "word is too long";
    if (term.meaning !== undefined && (typeof term.meaning !== "string" || term.meaning.length > MAX_LENGTH)) {
      return "invalid meaning";
    }
    if (term.exact !== undefined && term.exact !== true) return "exact must be true or absent";
    return null;
  }

  const compareWords = (a, b) => a.word.localeCompare(b.word, "en");

  // Same layout the editor has always written: version 2, sorted by word.
  function buildDictionary(terms) {
    const sorted = terms.map(normalizeTerm).sort(compareWords);
    return JSON.stringify({ version: 2, terms: sorted }, null, 2) + "\n";
  }

  const api = { DIR, fileName, fileContent, normalizeTerm, blobSha, checkTerm, buildDictionary };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.__dictionaryTermFiles = api;
})();
