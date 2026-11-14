# Platform Integration

## Contract Revision

- Platform repository: JaceDashS/jace-s-platform.
- Reviewed source revision: 230f1a6bc20d45271a8e9fd4307fa4e065760df0.
- The revision is published on platform dev. Verify the running deployment separately before installing this client; source publication alone does not prove deployment.
- Source contract: docs/api/80-udemy-translator.md in that revision. The shared entry contract is docs/api/10-client-integration.md.

## Connection And Authorization

The client uses https://api.jace-s.com/udemy-translator with dictionary, connect, session, logout, upload and conflicts routes. Production paths do not include the legacy api prefix. JSON data only is downloaded; JavaScript is packaged locally.

The user selected existing website login from any supported provider, including Google. A challenge checked first party page obtains a connection envelope with session token, CSRF token, expiry, user and upload permission, then delivers it directly to the requesting extension. Uploads require admin:write on admin:translator. Developer inspection uses the website session and translator read permission. A client supplied name never determines server authority.

Configure UDEMY_TRANSLATOR_EXTENSION_IDS on the API with the actual installed IDs before release. The existing development manifest key derives mmmljckioegeobbebbmildgebfjfbbdo; verify it in chrome://extensions. A store item ID must be registered separately if different. This origin exemption applies only to translator routes and does not change global website session policies.

## Release Order

1. Back up the existing platform database and deploy schema 32 and the new API and developer panel.
2. Import the pinned source with an existing authorized importer; compare every entry and the normalized digest. An uninitialized API returns 503 DICTIONARY_NOT_INITIALIZED instead of a misleading empty dictionary.
3. Configure allowed extension IDs and verify website session connection, including Google only accounts, upload permission, conflicts and history against the deployed revision.
4. Release version 3 only after those checks. New clients require an initial successful server dictionary download. Do not replace a working installed release before its API is available.

## Verification

The platform command npm run test:translator with this checkout path runs actual worker code with browser API adapters against actual HTTP routes. It covers initial offline gating, website session connection, automatic and manual upload, conflict isolation, explicit resolution, lost response replay, untrusted page rejection and offline restart without credentials.

Pinned source 24ae34ebdd6dccf565f7274aff39eb3fb12e033c has 1590 entries. Complete normalized comparison and idempotent trial import passed with digest fa78eaab4a606a376d99116dcf27f77f3720f18efb70d59ac4356dbfb20c0b12. The extension has 36 passing Node tests.

Browser HTML preview verified the editor controls and developer records using isolated fixture data. Real Chrome installation, side panel lifecycle, the isolated content bridge on Udemy and the Chrome translation model still require release validation. Production data has not been imported by these tests.

## Example Scenario

- Input: New client contacts a newly deployed API before dictionary import.
- Steps: The API responds 503, the editor keeps initial synchronization pending, then an authorized operator imports and verifies the source and the client retries download.
- Expected result: No empty dictionary is accepted as initialization; valid imported data enables local translation and later offline operation.

- Design: [Dictionary Sync](../design/translation/30-dictionary-sync.md)
- Scenarios: [Dictionary Sync Scenarios](../testing/scenarios/translation/30-dictionary-sync.md)
