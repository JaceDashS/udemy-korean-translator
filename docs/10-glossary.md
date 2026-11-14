# Glossary

## Quiz
- Definition: One Udemy practice test question with its answer choices, as found on the page
- Code: `extractQuiz()` returns `{ number, question, answers, nodes }`
- Avoid: "test", "exam" when referring to a single question

## Caption
- Definition: The English subtitle text Udemy shows over a lecture video, and the Korean overlay that replaces it
- Code: `caption.js`, `CAPTION_SELECTOR` (`[data-purpose="captions-cue-text"]`)
- Avoid: "subtitle track" (the extension reads the visible cue, not the track)

## Card
- Definition: The Udemy DOM element that wraps one answer choice, including its radio/checkbox control and feedback text
- Code: `cardOf()`, `quiz.nodes.cards`
- Avoid: "option element"

## Translator
- Definition: The Chrome built-in on-device Translator API instance (English to Korean)
- Code: `translator.js` → `start()`, `translate()`; `window.__udemyKoreanTranslator`
- Note: One translator is shared by the quiz and the captions

## Dictionary
- Definition: The list of developer terms kept in English in translations
- Code: `dictionary-terms.js`, `dictionary.js` → `protect()`, `restore()`, `configure()`
- Avoid: "glossary" for this feature (the glossary is this document)

## Term
- Definition: One row of the dictionary: an English word, an optional Korean meaning, and an optional case-sensitive flag
- Code: `configure()`, `normalizeRows()` in `dictionary.js`; `terms` in `dictionary.json`
- Avoid: "pair", "entry" (use "term")

## Meaning
- Definition: The Korean text that replaces a term in the translation. A term without a meaning stays in English
- Code: `meaningFor()`, `restore()` in `dictionary.js`
- Avoid: "translation" for this text

## Dictionary Branch
- Definition: Legacy source branch retained for migration and older releases; version 3 uses the on premises service and local state.
- Code: `tools/build-dictionary.js`.

## Editor
- Definition: The side panel that saves local terms and optionally uploads them through the authenticated on premises service.
- Code: `editor/index.html`, `editor/app.js`
- Avoid: "admin page"

## Term File
- Definition: The file of one dictionary term on the `dictionary` branch, `terms/<slug>-<hash>.json`. `dictionary.json` is built from all term files
- Code: `fileName()`, `fileContent()` in `editor/term-files.js`; `tools/build-dictionary.js`

## Conflict
- Definition: A changed server revision with a different proposed local value. The originating uploader explicitly resolves that item while others continue.
- Code: `sync-core.js` drafts, `editor/app.js` conflicts.
- Avoid: calling different terms changed at the same time a conflict; those merge without one

## Local Dictionary
- Definition: Persisted server terms and effective local overlays, usable offline after the first successful synchronization.
- Code: `sync-core.js` effective, `background.js`.

## Local Only Revision
- Definition: A local term deliberately excluded from automatic upload until edited or explicitly marked for sharing again.
- Code: Draft mode local in `sync-core.js`.

## Placeholder
- Definition: A `[[n]]` token that replaces a dictionary term during translation
- Code: `PLACEHOLDER` in `dictionary.js`

## Side Layout
- Definition: Inline translations floating in the empty space to the right of the quiz
- Code: `showSideTranslations()`, `.uqt-side-layer`
- Avoid: "sidebar" (that is Udemy's curriculum panel)

## Column Shift
- Definition: Overriding the horizontal margins of Udemy's centered quiz column so the original and its side translation are centered together
- Code: `shiftForSide()`, `centeredColumn()`, `restoreShift()`

## Inline Translation
- Definition: Korean text inserted into the Udemy page directly under the original question or answer
- Code: `showInlineTranslations()`, `data-udemy-quiz-inline`
- Avoid: "panel" (the panel UI was removed)
