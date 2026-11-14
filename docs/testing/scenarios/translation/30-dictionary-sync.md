# Dictionary Sync Scenarios

- Design: [Dictionary Sync](../../../design/translation/30-dictionary-sync.md)

## First Synchronization

- Input: A new installation offline, receiving invalid data or contacting an uninitialized API that returns 503 DICTIONARY_NOT_INITIALIZED.
- Steps: Try an edit, then download a valid snapshot.
- Expected result: Initial use stays gated until valid persistence completes.
- Test: tests/sync-core.test.js first synchronization.

## Offline Restart

- Input: Initialized terms and a saved local edit.
- Steps: Serialize and reload state, then download a newer server snapshot.
- Expected result: Local edit and its original upload baseline survive. Older or malformed downloads leave state unchanged.
- Test: tests/sync-core.test.js local edits survive a restart.

## Conflict And Independent Upload

- Input: One conflicting term and one independent pending term.
- Steps: Upload both and resolve the conflict as local only.
- Expected result: Only the conflicting term pauses. Its local meaning survives later downloads without automatically uploading again.
- Test: tests/sync-core.test.js conflicts pause one term; platform test:translator optional worker integration.

## In Flight Editing And Retry

- Input: A request is in flight while the term is edited again, or its response is lost.
- Steps: Receive the earlier acknowledgement or reload and retry.
- Expected result: Newer edits are not erased; unchanged logical operations retain their request IDs. SAM, sam and __proto__ remain ordinary distinct data.
- Test: tests/sync-core.test.js acknowledgement and retry cases.

## Resolution Choices

- Input: A paused conflict with the server version shown.
- Steps: Choose mine, server, local only or later in separate runs.
- Expected result: Mine repeats version checking, server replaces the local overlay, local only excludes uploads and later remains paused without a permanently queued resolution.
- Test: tests/sync-core.test.js; platform test:translator stale resolution and owner checks.

## Browser Editor

- Input: Isolated local API and actual worker code with browser API adapters.
- Steps: Log in, turn automatic upload off, edit course, change the server through another client, manually upload and select local only.
- Expected result: The UI exposes all four choices, clears the resolved conflict count, retains the local meaning and records the choice on the server.
- Verification: Browser preview validates editor controls and layout, not a real Chrome extension installation or the Udemy translation model.

## Legacy Import

- Input: Pinned legacy dictionary with 1590 terms.
- Steps: Run legacy conversion tests and platform optional import verification.
- Expected result: Every normalized entry survives and a repeated import creates no duplicates.
- Test: tests/term-files.test.js and platform test:translator with this repository path.
