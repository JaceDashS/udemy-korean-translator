# Test Strategy

## Unit Tests
Pure logic (the dictionary) is tested with the Node built-in test runner. No dependencies are needed.

```
node --test tests/dictionary.test.js tests/term-files.test.js
```

The test loads `dictionary-terms.js` and `dictionary.js` with `globalThis` as `window`.

## Manual Checks
Quiz extraction and the Chrome Translator API need a real Chrome on a Udemy quiz page. Load the unpacked extension and open a practice test.

Scenario:
- Input: A dictionary change
- Steps: Run the unit tests → reload the extension → open a Udemy quiz
- Result: Tests pass and the inline translation keeps the listed terms in English
