# Inline Translation

## Rendering
- Input: `quiz` from `extractQuiz()`, translated question, translated answers
- Output: `.udemy-quiz-inline-translation` elements inserted into the Udemy DOM, each marked with `data-udemy-quiz-inline`
- Code: `content.js` → `showInlineTranslations()`, `makeInlineTranslation()`, `clearInlineTranslations()`
- Steps: Remove previous inline nodes → insert the question translation before the first card → insert each answer translation after its card
- An `<li>` card gets an `<li>` translation so `<ul>`/`<ol>` stay valid
- Architecture: [Overview](../../architecture/10-overview.md#translation-flow)

## Avoiding Self Detection
Injected nodes must not be read back as quiz text or trigger re-translation.
- `findText()` skips text inside inline nodes
- `originalInnerText()` hides inline nodes while reading `innerText`
- The question range clone removes inline nodes before reading text
- `isOwnMutation()` ignores mutations caused by inline nodes

## Re-insertion
Udemy can replace answer elements with identical text. If the content key is unchanged
but the cards are new, `inlineIsCurrent()` returns false and the cached translations
are inserted again without calling the translator.

Scenario:
- Input: User selects an answer and Udemy re-renders the cards with the same text
- Steps: Observer fires → same key → `inlineIsCurrent()` false → `showInlineTranslations()` with `lastRendered`
- Result: Translations stay visible, no extra translation call
