# Live Caption Test Cases

- [Live Caption Design](../../../design/caption/10-live-caption.md)

## Look Ahead in the Transcript

- **Input** — An English transcript shows three cues for one sentence, with only the first cue appearing on the video. The browser has no standard caption track.
- **Steps** — Match the live cue against the transcript, then advance through the next two cues.
- **Result** — All three cue positions select the same complete sentence. The first cue of the next sentence selects a new translation.
- **Test** — `tests/caption-sentences.test.js` checks cue matching and sentence assembly.

## Resume From the Middle

- **Input** — Playback is paused on a middle cue of a complete sentence. A separate short cue appears more than once in the transcript.
- **Steps** — Reset the playback position and match the current cue from the transcript.
- **Result** — A unique current cue selects its complete sentence. A repeated cue without a known position waits for a unique match.
- **Test** — `tests/caption-sentences.test.js`.

## View a Caption Diagnostic

- **Input** — A playing lecture with three transcript cues for a single sentence.
- **Steps** — Start caption diagnostics, play through all cues, then stop the diagnostic.
- **Result** — The extension shows the playback time, source language, cue matching, translation state and displayed sentence IDs. The view has no transcript text.
- **Test** — `tests/caption-sentences.test.js`.

## Automatic Captions in Another Language

- **Input** — Japanese automatic captions with Japanese sentence punctuation and a separate unpunctuated passage.
- **Steps** — Play the captions with automatic language selection. Repeat with a manually selected Spanish source.
- **Result** — The appropriate source model translates to Korean. Complete sentences use their punctuation and long unpunctuated input splits at a caption boundary.
- **Test** — `tests/caption-sentences.test.js` uses simulated translation models.
