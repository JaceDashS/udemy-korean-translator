# Glossary

## Quiz
- Definition: One Udemy practice test question with its answer choices, as found on the page
- Code: `extractQuiz()` returns `{ number, question, answers, nodes }`
- Avoid: "test", "exam" when referring to a single question

## Card
- Definition: The Udemy DOM element that wraps one answer choice, including its radio/checkbox control and feedback text
- Code: `cardOf()`, `quiz.nodes.cards`
- Avoid: "option element"

## Translator
- Definition: The Chrome built-in on-device Translator API instance (English to Korean)
- Code: `translator`, `Translator.create()`, `translateCached()`

## Dictionary
- Definition: The list of developer terms kept in English in translations
- Code: `dictionary-terms.js`, `dictionary.js` → `protect()`, `restore()`, `configure()`
- Avoid: "glossary" for this feature (the glossary is this document)

## Pair
- Definition: A dictionary entry of an English word and its Korean meaning; the meaning replaces the word in the translation
- Code: `pairs` in `dictionary-terms.js`, `configure()`, `meaningFor()` in `dictionary.js`
- Avoid: "translation pair" (a pair here is always word → meaning)

## Dictionary Branch
- Definition: The `dictionary` branch of this repository, which holds `dictionary.json` with the pairs
- Code: `GLOSSARY_URL` in `content.js`, `editor/index.html`
- Avoid: "sync branch"

## Editor
- Definition: The static page that edits pairs and registers them to the dictionary branch
- Code: `editor/index.html`, `register()`
- Avoid: "admin page"

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
