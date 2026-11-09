/*
 * Developer term dictionary.
 * - Terms listed in dictionary-terms.js are kept in English: they are replaced
 *   with [[n]] placeholders before translation and restored afterwards.
 * - Pairs (word → meaning) are replaced with the meaning instead of the word.
 */
(() => {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  const data = root.__udemyQuizTranslatorTerms || {};

  // The translator sometimes adds a bracket ("[[[0]]"); absorb extras.
  const PLACEHOLDER = /\[*\[\[\s*(\d+)\s*\]\]\]*/g;

  function escapeTerm(term) {
    return term
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s+");
  }

  // A plural suffix is allowed only after a letter ("instances", "VPCs").
  function termPattern(term) {
    const plural = /[A-Za-z]$/.test(term.trim()) ? "(?:e?s)?" : "";
    return `${escapeTerm(term)}${plural}`;
  }

  // Acronyms ("SAM", "LAG") must not match ordinary words ("Sam", "lag").
  const isAcronym = term => !/[a-z]/.test(term);

  // Pair keys are compared case-insensitively with collapsed whitespace.
  const normalize = text => text.trim().toLowerCase().replace(/\s+/g, " ");

  // One regex for all terms, longest first, so "IAM role" wins over "IAM"
  // and "AWS Lambda function" over "AWS Lambda". Case-insensitive terms use
  // an inline (?i:) modifier (Chrome 125+).
  function buildRegex(entries) {
    if (!entries.size) return null;

    const alternatives = [...entries]
      .sort(([a], [b]) => b.length - a.length)
      .map(([term, sensitive]) =>
        sensitive ? termPattern(term) : `(?i:${termPattern(term)})`
      );

    return new RegExp(
      `(?<![A-Za-z0-9_\-])(?:${alternatives.join("|")})(?![A-Za-z0-9_])`,
      "g"
    );
  }

  // Later sources override earlier ones: groups < caseSensitive < pairs.
  function collectEntries(pairs) {
    const entries = new Map();
    const add = (term, sensitive) => {
      const trimmed = term.trim();
      if (trimmed) entries.set(trimmed, sensitive);
    };

    for (const term of Object.values(data.groups || {}).flat()) {
      add(term, isAcronym(term));
    }
    for (const term of data.caseSensitive || []) add(term, true);
    for (const term of Object.keys(pairs)) add(term, isAcronym(term));

    return entries;
  }

  let termRegex = null;
  let meaningOf = new Map();
  let size = 0;

  /**
   * Rebuild the matcher. `pairs` maps an English word to its Korean meaning.
   * Calling it again replaces the previous pairs (used for remote updates).
   */
  function configure(pairs = data.pairs || {}) {
    const pairEntries = Object.entries(pairs).filter(
      ([term, meaning]) => term.trim() && typeof meaning === "string" && meaning.trim()
    );

    meaningOf = new Map(
      pairEntries.map(([term, meaning]) => [normalize(term), meaning.trim()])
    );

    const entries = collectEntries(Object.fromEntries(pairEntries));
    termRegex = buildRegex(entries);
    size = entries.size;
  }

  // "subnets" finds the pair for "subnet" when the plural itself is not listed.
  function meaningFor(surface) {
    const key = normalize(surface);
    if (meaningOf.has(key)) return meaningOf.get(key);
    return meaningOf.get(key.replace(/es$|s$/, ""));
  }

  configure();

  /**
   * Replace dictionary terms with [[n]] placeholders.
   * Returns { text, terms, meanings } where terms[n] is the original surface text
   * and meanings[n] is the Korean meaning for a pair (undefined for kept terms).
   */
  function protect(source) {
    const terms = [];
    const meanings = [];
    if (!source || /\[\[\s*\d+\s*\]\]/.test(source)) {
      return { text: source || "", terms, meanings };
    }

    if (!termRegex) return { text: source, terms, meanings };

    const text = source.replace(termRegex, match => {
      terms.push(match);
      meanings.push(meaningFor(match));
      return `[[${terms.length - 1}]]`;
    });

    return { text, terms, meanings };
  }

  /**
   * Put the terms back: a pair becomes its meaning, a kept term its English text.
   * Returns null when any placeholder was lost, so the caller can fall back
   * to a plain translation.
   */
  function restore(translated, terms, meanings = []) {
    if (!terms.length) return translated;

    const seen = new Set();
    const restored = translated.replace(PLACEHOLDER, (match, n) => {
      const index = Number(n);
      if (index >= terms.length) return match;
      seen.add(index);
      return meanings[index] ?? terms[index];
    });

    return seen.size === terms.length ? restored : null;
  }

  root.__udemyQuizTranslatorDictionary = {
    protect,
    restore,
    configure,
    get size() {
      return size;
    }
  };
})();
