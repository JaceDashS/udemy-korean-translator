# Live Caption Scenarios

## Live Caption Scenarios
- Design: [Live Caption Design](../../../design/caption/10-live-caption.md#caption-translation)

### Caption Translated After Start
- Input: Lecture "251. Final Exam Tips" with English CC; cue "You can make sure you have really understood everything and you had memorized it."
- Steps: Translation started → `drain()` → `setKorean()`
- Result: Overlay shows "당신은 당신이 모든 것을 정말로 이해하고 그것을 암기했는지 확인할 수 있습니다."; the English cue is hidden
- Test: Manual on Udemy (passed 2026-11-10 with the button click)

### Captions Start by Themselves
- Input: Lecture with English CC; the model is installed; captions were not turned off before
- Steps: Page load → `core.onReady()` → `start()`
- Result: Korean captions appear without clicking the button; the button reads 한국어 CC 끄기 ×
- Test: Manual (not yet run after the change)

### Turning Off Is Remembered
- Input: User clicks 한국어 CC 끄기 ×, then opens another lecture
- Steps: `stop()` and `localStorage.udemyKoreanCaptionOff = "1"` → next page: `core.onReady()` skips `start()`
- Result: English captions only, button reads 한국어 CC 시작; clicking it starts again and clears the flag
- Test: Manual (not yet run)

### Model Must Be Downloaded
- Input: New PC; `Translator.availability()` returns `downloadable`
- Steps: First click on the page → core creates the translator → `core.onReady()` → `start()`
- Result: Korean captions start after the download; a click on the caption button instead shows the download percent on the button
- Test: Manual (not yet run)

### Dictionary Terms in Captions
- Input: Cue "Launch an EC2 instance in a private subnet"
- Steps: `core.translate()` → dictionary `protect()` / `restore()`
- Result: "private subnet" and "EC2 instance" stay in English, as in the quiz
- Test: Manual (not yet run)
