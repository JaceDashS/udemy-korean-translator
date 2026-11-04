# Startup

## Automatic Start
- Input: Page load on a Udemy URL
- Output: A ready `translator`, or a console message explaining why it did not start
- Code: `content.js` → `autoStart()`, `startOnFirstGesture()`, `initialize()`
- Architecture: [Overview](../../architecture/10-overview.md#translation-flow)

`Translator.availability()` decides the path:

| Availability | Action |
| --- | --- |
| `available` | Create the translator immediately |
| `downloadable`, `downloading` | Wait for the first `pointerdown` or `keydown` on the page, then create it (a download requires user activation) |
| `unavailable` or API missing | Log a warning and stay idle |

```mermaid
flowchart TD
    A[Page load] --> B{Translator API?}
    B -- No --> W[console.warn]
    B -- Yes --> C{availability}
    C -- available --> I[initialize]
    C -- downloadable --> G[Wait for first click or key] --> I
    C -- unavailable --> W
    I --> S[schedule update]
```

Scenario:
- Input: New PC, model not downloaded, user opens a Udemy quiz
- Steps: `availability()` returns `downloadable` → listeners registered → user clicks an answer → `Translator.create()` downloads the model → `schedule(true)`
- Result: Inline translations appear after the download; progress is logged in the console

## Console Helpers
`window.udemyLocalTranslator` exposes `start()`, `refresh()`, and `destroy()` for manual control from DevTools.
