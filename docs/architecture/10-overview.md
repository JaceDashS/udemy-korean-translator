# Architecture Overview

## Files
- `manifest.json` — Manifest V3. Injects the content script into Udemy pages in the `MAIN` world.
- `content.js` — Single IIFE. Detects the quiz, translates it with the Chrome Translator API, and renders the result.

## Translation Flow
A `MutationObserver` watches the Udemy page. On change, `update()` extracts the
current quiz, translates the question and each answer, and inserts the Korean text
inline under the original elements. A floating panel also shows the same result.

```mermaid
flowchart LR
    A[Udemy DOM change] --> B[schedule]
    B --> C[extractQuiz]
    C --> D[translateCached]
    D --> E[showInlineTranslations]
    D --> F[render panel]
```

Scenario:
- Input: User moves from Question 3 to Question 4
- Steps: Observer fires → `extractQuiz()` returns question 4 → translated → old inline nodes removed, new ones inserted
- Result: Korean text for question 4 appears under the original question and each answer

## Modules Inside content.js
- Panel UI — Shadow DOM launcher and resizable panel
- Inline rendering — `showInlineTranslations()`, `clearInlineTranslations()`; see [Inline Translation](../design/quiz/10-inline-translation.md)
- Extraction — `extractQuiz()`, `cardOf()`, `originalInnerText()`
- Translation — `initialize()`, `translateCached()`
