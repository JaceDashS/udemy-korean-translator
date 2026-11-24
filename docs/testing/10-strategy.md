# Test Strategy

## Unit Tests

.github/workflows/test.yml runs all tests on main pushes and pull requests with Node 24. The legacy dictionary branch build remains a separate migration source workflow.
Pure logic (the dictionary) is tested with the Node built-in test runner. No dependencies are needed.

```
node --test tests/*.test.js
```

The test loads `dictionary-terms.js` and `dictionary.js` with `globalThis` as `window`.

## Manual Checks
Quiz extraction and the Chrome Translator API need a real Chrome on a Udemy quiz page. Load the unpacked extension and open a practice test.

Scenario:
- Input: A dictionary change
- Steps: Run the unit tests → reload the extension → open a Udemy quiz
- Result: Tests pass and the inline translation keeps the listed terms in English

## Worker Integration

The platform test:translator script accepts this repository path as an optional argument. It runs actual worker code with browser API adapters against actual Express routes, covering offline restart and sender isolation. It does not replace real Chrome and Udemy model validation.
