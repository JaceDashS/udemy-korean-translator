# Dictionary Sync Test Cases

- [Dictionary Sync Design](../../../design/translation/30-dictionary-sync.md)

## Upload Selected Revisions

- **Input** — Multiple unsent edits and an authorized uploader.
- **Steps** — Select a revision for upload and edit that word again before submission.
- **Result** — The previous selection does not upload the new revision. Unchecked words stay local.
- **Test** — `tests/sync-core.test.js`.

## Request Review After a Conflict

- **Input** — A local edit differs from a newer public value.
- **Steps** — Fetch the current public word and request review.
- **Result** — The local value remains effective and the current public value stays in the server layer.
- **Test** — `tests/sync-core.test.js`.
