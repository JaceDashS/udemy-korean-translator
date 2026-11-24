(() => {
  const segmenters = new Map();
  const terminal = /[.!?。！？؟।॥]["'”’»)}\]」』】]*$/;
  const limit = language => /^(ja|zh|ko)/.test(language) ? 60 : 160;
  const normalize = text => text.normalize("NFC").replace(/\s+/g, " ").trim();

  function completeSentences(text, language, cueEnds, flushTail = true) {
    // Preserve indices so every sentence still maps to its original cue times.
    const normalized = language === "en" ? text.replace(/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|e\.g|i\.e)\./gi,
      abbreviation => abbreviation.replaceAll(".", "·")) : text;
    if (!segmenters.has(language)) segmenters.set(language, new Intl.Segmenter(language, { granularity: "sentence" }));
    return [...segmenters.get(language).segment(normalized)].flatMap(({ segment, index }) => {
      const content = segment.trim();
      const start = index + segment.indexOf(content);
      const end = start + content.length;
      if (terminal.test(content)) return [{ text: text.slice(start, end), start, end }];
      const chunks = [];
      let from = start;
      for (const to of cueEnds) {
        if (to <= end && to - from >= limit(language)) {
          chunks.push({ text: text.slice(from, to), start: from, end: to });
          from = to + 1;
        }
      }
      if (flushTail && from < end && cueEnds.at(-1) === end) {
        chunks.push({ text: text.slice(from, end), start: from, end });
      }
      return chunks;
    });
  }

  function liveSentences(language = "en") {
    let pending = "";
    let previous = [];

    return cues => {
      // Some players retain one or more lines as they add the next line.
      let overlap = Math.min(previous.length, cues.length);
      while (overlap && !cues.slice(0, overlap).every((cue, index) =>
        cue === previous[previous.length - overlap + index])) overlap--;
      previous = cues;
      const next = cues.slice(overlap).join(" ");
      if (!next) return [];

      pending = `${pending} ${next}`.trim();
      const sentences = completeSentences(pending, language, [pending.length], false);
      if (sentences.length) pending = pending.slice(sentences.at(-1).end).trimStart();
      return sentences.map(sentence => sentence.text);
    };
  }

  function timedSentences(cues, language = "en") {
    const ranges = [];
    let text = "";

    for (const cue of cues) {
      const content = cue.textContent.replace(/\s+/g, " ").trim();
      if (!content || !(cue.endTime > cue.startTime)) continue;
      if (text) text += " ";
      ranges.push({ start: text.length, length: content.length, cue });
      text += content;
    }

    let rangeIndex = 0;
    function timeAt(offset, isEnd) {
      while (rangeIndex + 1 < ranges.length &&
          offset >= ranges[rangeIndex].start + ranges[rangeIndex].length) rangeIndex++;
      const { start, length, cue } = ranges[rangeIndex];
      const fraction = (offset - start + Number(isEnd)) / length;
      return cue.startTime + fraction * (cue.endTime - cue.startTime);
    }

    return completeSentences(text, language, ranges.map(range => range.start + range.length)).map(sentence => ({
      text: sentence.text,
      startTime: timeAt(sentence.start, false),
      endTime: timeAt(sentence.end - 1, true)
    }));
  }

  function transcriptSentences(cues, language = "en") {
    const offsets = [];
    const byText = new Map();
    const byCue = [];
    let text = "";
    for (const cue of cues) {
      const value = normalize(cue);
      if (!value) continue;
      if (text) text += " ";
      const index = offsets.length;
      offsets.push(text.length);
      byCue.push([]);
      if (!byText.has(value)) byText.set(value, []);
      byText.get(value).push(index);
      text += value;
    }

    let cueIndex = 0;
    function indexAt(offset) {
      while (offsets[cueIndex + 1] <= offset) cueIndex++;
      return cueIndex;
    }
    const cueEnds = offsets.slice(1).map(offset => offset - 1).concat(text.length);
    const sentences = completeSentences(text, language, cueEnds).map(({ text, start, end }, index) => {
      const first = indexAt(start);
      const last = indexAt(end - 1);
      for (let i = first; i <= last; i++) byCue[i].push(index);
      return { text, last };
    });

    function locate(caption, previous) {
      const matches = byText.get(normalize(caption)) ?? [];
      if (previous < 0) return matches.length === 1 ? matches[0] : -1;
      if (matches.includes(previous)) return previous;
      return matches.find(index => index > previous) ?? -1;
    }

    return { sentences, byCue, locate };
  }

  globalThis.__udemyCaptionSentences = { liveSentences, timedSentences, transcriptSentences };
})();
