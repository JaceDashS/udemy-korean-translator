/*
 * Developer term dictionary.
 * Terms listed in dictionary-terms.js are kept in English: they are replaced
 * with [[n]] placeholders before translation and restored afterwards.
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

  // One regex for all terms, longest first, so "IAM role" wins over "IAM"
  // and "AWS Lambda function" over "AWS Lambda". Case-insensitive terms use
  // an inline (?i:) modifier (Chrome 125+).
  function buildRegex(sensitiveTerms, insensitiveTerms) {
    const entries = new Map();
    for (const t of insensitiveTerms) entries.set(t.trim(), false);
    for (const t of sensitiveTerms) entries.set(t.trim(), true);
    entries.delete("");
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

  const groupTerms = Object.values(data.groups || {}).flat();
  const insensitiveTerms = groupTerms.filter(t => !isAcronym(t));
  const sensitiveTerms = [
    ...(data.caseSensitive || []),
    ...groupTerms.filter(isAcronym)
  ];

  const termRegex = buildRegex(sensitiveTerms, insensitiveTerms);

  /**
   * Replace dictionary terms with [[n]] placeholders.
   * Returns { text, terms } where terms[n] is the original surface text.
   */
  function protect(source) {
    const terms = [];
    if (!source || /\[\[\s*\d+\s*\]\]/.test(source)) {
      return { text: source || "", terms };
    }

    if (!termRegex) return { text: source, terms };

    const text = source.replace(termRegex, match => {
      terms.push(match);
      return `[[${terms.length - 1}]]`;
    });

    return { text, terms };
  }

  /**
   * Put the original terms back. Returns null when any placeholder was lost,
   * so the caller can fall back to a plain translation.
   */
  function restore(translated, terms) {
    if (!terms.length) return translated;

    const seen = new Set();
    const restored = translated.replace(PLACEHOLDER, (match, n) => {
      const index = Number(n);
      if (index >= terms.length) return match;
      seen.add(index);
      return terms[index];
    });

    return seen.size === terms.length ? restored : null;
  }

  root.__udemyQuizTranslatorDictionary = {
    protect,
    restore,
    size: new Set([...insensitiveTerms, ...sensitiveTerms]).size
  };
})();
