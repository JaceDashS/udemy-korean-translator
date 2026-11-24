# Live Caption

## Requirements
- On a Udemy lecture with supported source captions, including automatically generated captions, Korean captions appear over the video in real time
- Prefer declared language metadata. Infer the language from captions when metadata is unavailable, with English as the fallback.
- The release caption controls expose the Korean caption toggle and the original-caption checkbox.
- Korean captions start by themselves once the translator is ready. A new PC that must download the model starts after the first click on the page
- With a complete caption track or a loaded transcript, translate a sentence as one unit and display the result from its first cue through its last cue. If only live cues are available, accumulate them until the sentence is complete.
- When punctuation is missing, split long accumulated caption text at cue boundaries. Use any remaining unpunctuated text when the entire transcript is available.
- The button on the video (한국어 CC 끄기 × / 한국어 CC 시작) turns Korean captions off and on. Turning them off is remembered on this browser until they are turned on again
- Developer terms from the dictionary apply to captions the same way as to the quiz
- In native video fullscreen the overlay cannot be shown, so the English captions stay
- Udemy's caption DOM is never changed; only a class on `<html>` hides it and a separate overlay shows the Korean text

- **Input** — One sentence is split across three English cues and all three appear in the transcript.
- **Steps** — Start playback at the first cue, then play through the third cue.
- **Result** — The complete Korean sentence appears as soon as the prepared translation is available and stays through the third cue.

- Design: [Live Caption Design](../../design/caption/10-live-caption.md#caption-translation)
