# Platform Integration

## Contract Revision

- Platform repository: JaceDashS/jace-s-platform.
- Reviewed source revision: 230f1a6bc20d45271a8e9fd4307fa4e065760df0.
- The revision is published on platform dev and deployed. Production schema 32, all 1590 imported terms, anonymous write rejection and configured extension CORS passed verification. Actual installed Chrome connection and two computer conflict acceptance remain pending.
- Source contract: docs/api/80-udemy-translator.md in that revision. The shared entry contract is docs/api/10-client-integration.md.

## Connection And Authorization

The client uses https://api.jace-s.com/udemy-translator with dictionary, dictionary item lookup, connect, session, logout, upload and conflict routes. The extension packages its JavaScript locally and downloads dictionary data as JSON.

A challenge-checked first-party page obtains a connection envelope and delivers it to the requesting extension. Uploads require the new-word upload grant or dictionary management access. Management uses the admin website session. The server records the authenticated actor.

Configure UDEMY_TRANSLATOR_EXTENSION_IDS on the API with the actual installed IDs before release. The existing development manifest key derives mmmljckioegeobbebbmildgebfjfbbdo; verify it in chrome://extensions. A store item ID must be registered separately if different. This origin exemption applies only to translator routes and does not change global website session policies.

## Production Compatibility

Version 3.1.3 uses the dictionary management API deployed on 2026-11-24 with SQLite schema 48. The existing 1,590 entries and change history were checked during deployment. New installations require one successful dictionary download.

## Verification

The platform command `npm run test:translator` with this checkout path runs the worker against actual HTTP routes with browser API adapters. It covers initial offline gating, website session connection, selected uploads, conflict isolation, lost response replay, page sender rejection and offline restart.

Pinned source 24ae34ebdd6dccf565f7274aff39eb3fb12e033c has 1590 entries. Complete normalized comparison and idempotent trial import passed with digest fa78eaab4a606a376d99116dcf27f77f3720f18efb70d59ac4356dbfb20c0b12. The extension has 36 passing Node tests.

Browser HTML preview verified the editor controls and developer records using isolated fixture data. Real Chrome installation, side panel lifecycle, the isolated content bridge on Udemy and the Chrome translation model still require release validation. Production data has not been imported by these tests.

The separate production migration completed on 2026 11 14 and compared the entire public dictionary with the pinned source. On 2026 11 15 an existing signed in website session opened Developer and displayed dictionary and import history records. This does not claim a real installed extension connection has been exercised. Source and runtime verification: [Platform Rollout](https://github.com/JaceDashS/jace-s-platform/blob/dev/docs/operations/90-translator-rollout.md). Physical acceptance steps: [Two Computer Acceptance](https://github.com/JaceDashS/jace-s-platform/blob/dev/docs/guides/88-translator-migration.md#two-computer-acceptance).

## Example Scenario

- Input: New client contacts a newly deployed API before dictionary import.
- Steps: The API responds 503, the editor keeps initial synchronization pending, then an authorized operator imports and verifies the source and the client retries download.
- Expected result: No empty dictionary is accepted as initialization; valid imported data enables local translation and later offline operation.

- Design: [Dictionary Sync](../design/translation/30-dictionary-sync.md)
- Scenarios: [Dictionary Sync Scenarios](../testing/scenarios/translation/30-dictionary-sync.md)
