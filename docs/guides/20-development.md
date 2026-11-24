# Development

Technical notes moved out of the README, which is written for users.

## Load From Source
1. Open `chrome://extensions` in desktop Chrome 138 or later and turn on Developer mode.
2. Load unpacked → select the repository folder (`manifest.json` at its root).
3. After changing code, press the reload button on the extension card, then refresh the Udemy page.

Example:
- Input: `caption.js` changed
- Steps: Reload the extension card → refresh the lecture page
- Result: The new caption code runs; the console shows `[Korean Translator]` messages

## Console Helpers
On a Udemy page, in the DevTools console:

```js
window.udemyKoreanQuiz.start()
window.udemyKoreanQuiz.refresh()
window.udemyKoreanQuiz.layoutInfo()
window.udemyKoreanQuiz.destroy()
```

Status and errors are logged with the `[Korean Translator]` prefix.

## Build a Release

Run the following commands from the extension repository. The build uses Python 3 and the version in `manifest.json`.

```sh
node --test tests/*.test.js
python tools/build-release.py
```

The build creates a ZIP and a SHA-256 checksum in `dist/`. It verifies the archive against the runtime source files after normalizing text line endings. Extract the ZIP and load the folder in Chrome for testing.

- **Input** — A checkout whose manifest version is 3.1.3.
- **Steps** — Run the tests and build command, then open the ZIP.
- **Result** — The manifest is at the archive root and the archive contains the runtime files only.

## Dictionary Matching Rules
- Terms without a meaning stay in English in the translation; terms with a meaning are replaced by it
- All-capital acronyms (SAM, LAG) match only with the same case. Names that are ordinary words in lowercase (Projects, Haiku) need 대소문자 구분 in the editor
- Do not add everyday words such as "object", "request", or "continue"; every sentence would keep them in English
- Plurals (s/es) match automatically; other forms such as "deterministically" must be added separately
- Terms are supplied from the initialized local dictionary. Server checks preserve unsent edits; first use requires one successful download.
- Design: [Dictionary](../design/translation/20-dictionary.md), [Dictionary Sync](../design/translation/30-dictionary-sync.md)

## Tests
`node --test tests/*.test.js`

## Known Limits
- Udemy DOM changes can break quiz or caption detection
- Not every quiz type has been checked on a real account
- Frames other than the main page are not supported
- Requires desktop Chrome 138 or later and a supported on-device language pair
- Native video fullscreen keeps the English captions

## References
- https://developer.chrome.com/docs/ai/translator-api
- https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts
