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
window.udemyKoreanCaption.start()
window.udemyKoreanCaption.stop()
```

Status and errors are logged with the `[Korean Translator]` prefix.

## Dictionary Matching Rules
- Terms without a meaning stay in English in the translation; terms with a meaning are replaced by it
- All-capital acronyms (SAM, LAG) match only with the same case. Names that are ordinary words in lowercase (Projects, Haiku) need 대소문자 구분 in the editor
- Do not add everyday words such as "object", "request", or "continue"; every sentence would keep them in English
- Plurals (s/es) match automatically; other forms such as "deterministically" must be added separately
- The terms are loaded from the `dictionary` branch on each page load; when that fails, `dictionary-terms.js` is used
- Design: [Dictionary](../design/translation/20-dictionary.md), [Dictionary Sync](../design/translation/30-dictionary-sync.md)

## Tests
`node --test tests/dictionary.test.js`

## Known Limits
- Udemy DOM changes can break quiz or caption detection
- Not every quiz type has been checked on a real account
- Frames other than the main page are not supported
- Requires desktop Chrome 138 or later and its built-in English to Korean model
- Native video fullscreen keeps the English captions

## References
- https://developer.chrome.com/docs/ai/translator-api
- https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts
