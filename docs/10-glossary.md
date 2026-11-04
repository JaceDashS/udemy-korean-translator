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
- Code: `dictionary-terms.js`, `dictionary.js` → `protect()`, `restore()`
- Avoid: "glossary" for this feature (the glossary is this document)

## Placeholder
- Definition: A `[[n]]` token that replaces a dictionary term during translation
- Code: `PLACEHOLDER` in `dictionary.js`

## Inline Translation
- Definition: Korean text inserted into the Udemy page directly under the original question or answer
- Code: `showInlineTranslations()`, `data-udemy-quiz-inline`
- Avoid: "panel" (the panel UI was removed)
