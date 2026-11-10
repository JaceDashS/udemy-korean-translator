#!/usr/bin/env node
/*
 * Builds dictionary.json from the term files, or splits a dictionary.json into
 * term files. Run by the dictionary branch's GitHub Actions workflow and once
 * for the conversion of the existing terms.
 *
 *   node tools/build-dictionary.js build <terms dir> <dictionary.json out>
 *   node tools/build-dictionary.js split <dictionary.json> <terms dir>
 *   node tools/build-dictionary.js verify <dictionary.json> <terms dir>
 *
 * build fails (exit 1) when a file is not a valid term or is not stored under
 * the name fileName(word) gives, so a bad file never reaches the extension.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const termFiles = require("../editor/term-files.js");

async function readTerms(dir) {
  const terms = [];
  const errors = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith(".json")) continue;
    const where = `${termFiles.DIR}/${name}`;
    let term;
    try {
      term = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
    } catch (error) {
      errors.push(`${where}: invalid JSON (${error.message})`);
      continue;
    }
    const problem = termFiles.checkTerm(term);
    if (problem) {
      errors.push(`${where}: ${problem}`);
      continue;
    }
    const expected = await termFiles.fileName(term.word);
    if (expected !== where) {
      errors.push(`${where}: must be named ${expected}`);
      continue;
    }
    terms.push(term);
  }
  return { terms, errors };
}

async function build(dir, out) {
  const { terms, errors } = await readTerms(dir);
  if (errors.length) throw new Error(`Invalid term files:\n${errors.join("\n")}`);
  fs.writeFileSync(out, termFiles.buildDictionary(terms));
  console.log(`Built ${out} with ${terms.length} terms.`);
}

function readDictionary(file) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (data.version !== 2 || !Array.isArray(data.terms)) throw new Error(`${file} is not version 2.`);
  return data.terms;
}

async function split(file, dir) {
  const terms = readDictionary(file);
  fs.mkdirSync(dir, { recursive: true });
  const seen = new Map();
  for (const term of terms) {
    const problem = termFiles.checkTerm(term);
    if (problem) throw new Error(`${JSON.stringify(term)}: ${problem}`);
    const name = await termFiles.fileName(term.word);
    if (seen.has(name)) throw new Error(`"${term.word}" and "${seen.get(name)}" map to ${name}.`);
    seen.set(name, term.word);
    fs.writeFileSync(path.join(dir, path.basename(name)), termFiles.fileContent(term));
  }
  console.log(`Wrote ${terms.length} term files to ${dir}.`);
}

// Every original term must come back unchanged from the term files, and nothing else.
async function verify(file, dir) {
  const original = readDictionary(file);
  const { terms, errors } = await readTerms(dir);
  if (errors.length) throw new Error(`Invalid term files:\n${errors.join("\n")}`);

  const key = t => JSON.stringify(termFiles.normalizeTerm(t));
  const left = new Set(original.map(key));
  const right = new Set(terms.map(key));
  const missing = [...left].filter(k => !right.has(k));
  const extra = [...right].filter(k => !left.has(k));
  const raw = original.filter(t => key(t) !== JSON.stringify(t));
  console.log(`original ${original.length}, unique ${left.size}, term files ${terms.length}`);
  console.log(`missing ${missing.length}, extra ${extra.length}, normalized rows ${raw.length}`);
  for (const k of [...missing, ...extra].slice(0, 20)) console.log(`  ${k}`);
  for (const t of raw.slice(0, 20)) console.log(`  normalized: ${JSON.stringify(t)}`);

  const rebuilt = termFiles.buildDictionary(terms);
  const same = rebuilt === fs.readFileSync(file, "utf8");
  console.log(`rebuilt dictionary.json byte-identical: ${same}`);
  if (missing.length || extra.length || original.length !== terms.length) {
    throw new Error("Verification failed.");
  }
}

const [command, a, b] = process.argv.slice(2);
const commands = { build, split, verify };
if (!commands[command] || !a || !b) {
  console.error("Usage: build-dictionary.js build|split|verify <a> <b>");
  process.exit(2);
}
commands[command](a, b).catch(error => {
  console.error(error.message);
  process.exit(1);
});
