# Dictionary Sync

## Requirements

- Require one successful persisted server dictionary download before first use. Thereafter preserve offline translation and saved local edits across restarts and server outages.
- Download at startup, online restoration and manual refresh without overwriting unsent or deliberately local changes.
- Automatic upload defaults on. Only Admin or an account granted translator write may upload. Turning it off retains edits until manual upload.
- Compare and upload one item at a time. Identical values are acknowledged without duplication. Different concurrent server values pause only that item and are logged.
- Display a conflict count, list and toolbar badge. The originating uploader chooses mine, server, local only or later. Recheck the displayed version before replacing a server value.
- Local only excludes that revision from upload until edited or explicitly marked for sharing. Later leaves the conflict paused.
- Reuse the existing website session from Google or any supported login method. Do not ask for a password in the extension. Verify the first party connection challenge before retaining credentials in trusted extension session storage.
- Preserve original word, optional meaning and exact semantics. Missing meaning preserves the original term. Limit effective terms to 10000 and text fields to 200 characters.
- Server writes record authenticated actors, change history and conflict resolutions for authorized developer inspection.

## Related Documents

- Design: [Dictionary Sync](../../design/translation/30-dictionary-sync.md)
- Scenarios: [Dictionary Sync Scenarios](../../testing/scenarios/translation/30-dictionary-sync.md)
- Guide: [Dictionary Editor](../../guides/10-dictionary-editor.md)

## Example Scenario

- Input: Two initialized clients edit course differently.
- Steps: One uploads, the second encounters a logged conflict and chooses local only; independent terms continue uploading.
- Expected result: Both meanings are preserved in their respective locations and the local revision stops uploading automatically.
