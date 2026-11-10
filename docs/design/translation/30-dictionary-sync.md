# Dictionary Sync Design

## Load and Register
- Input: `GLOSSARY_URL` (raw `dictionary.json` on the `dictionary` branch); editor rows and the GitHub contents API
- Output: `configure(rows)` on the dictionary matcher; a commit on the `dictionary` branch
- Code: `content.js` → `loadGlossary()`, `isValidTerms()`; `dictionary.js` → `configure()`; `editor/app.js` → `load()`, `submit()`
- Spec: [Dictionary Sync](../../specs/translation/30-dictionary-sync.md#requirements)
- Architecture: [Overview](../../architecture/10-overview.md#dictionary-sync)

Steps:
1. `loadGlossary()` fetches the raw file with `cache: "no-store"` and a 3 second abort timeout
2. The response must be OK JSON with `version` 2 and a valid `terms` array (`isValidTerms()`)
3. `configure(terms)` replaces the bundled list entirely
4. On any failure the bundled list stays in use and a warning is logged
5. `autoStart()` runs after step 4, so the first translation uses the loaded terms

```mermaid
flowchart LR
    A[Page load] --> B[fetch dictionary.json]
    B --> C{OK and valid?}
    C -- Yes --> D[configure with remote terms]
    C -- No --> E[keep bundled terms]
    D --> F[autoStart]
    E --> F
```

Representative scenario:
- Input: Remote `terms` = `[{ "word": "private subnet", "meaning": "프라이빗 서브넷" }]`
- Steps: `loadGlossary()` → `isValidTerms()` true → `configure()` → `protect()` on "a private subnet"
- Result: Translation contains `프라이빗 서브넷`
- All scenarios: [Dictionary Sync Scenarios](../../testing/scenarios/translation/30-dictionary-sync.md#dictionary-sync-scenarios)

## Editor
- `editor/index.html` is a single static page (GitHub Pages). It reads `dictionary.json` from the branch and shows the rows in a spreadsheet-style table: 단어, 뜻, 대소문자 구분 (checkbox), with a row number column
- Each row is one term. Edits change the row in memory; the table is rebuilt only for add, delete, sort, and search, so the cell being typed in keeps its focus
- Enter moves to the same column in the next row. Pasting tab-separated text (word, meaning, Y) into a cell inserts one row per line after the current row
- Headers sort the table. The search box filters by word or meaning
- The table shows 50, 100 (default), or 200 rows per page. Searching, sorting, and adding a term return to page 1
- The layout uses only the width its content needs (`fit-content`)
- Duplicate or empty words are highlighted and block registration
- The commit message lists added, changed, and removed words. Rows are sorted by word, and empty meanings are omitted
- Outside the extension (GitHub Pages) the editor is read-only: the button stays disabled and the status line says registering is in the side panel

## Register Chain
- Input: The edited rows; a click on 등록 / PR 제안
- Output: A commit on `dictionary` (owner) or a pull request (others), shown in the status line
- Code: `editor/app.js` → `startChain()`, `continueFromStatus()`, `approveInstall()`, `approveLogin()`, `submit()`, `onRegisterClick()`; `background.js` → `connect()`, `ask()`, `stop()`
- Spec: [Dictionary Sync](../../specs/translation/30-dictionary-sync.md#requirements)
- Architecture: [Overview](../../architecture/10-overview.md#dictionary-sync)

```mermaid
flowchart TD
    S[Click 등록 / PR 제안] --> A{ping answers?}
    A -- host not found --> R[Open setup tab, poll ping every 2s] --> B
    A -- yes --> B{status: gh installed?}
    B -- no --> I[Button: GitHub CLI 설치] -->|click| I2[install via winget] --> B
    B -- yes --> C{logged in?}
    C -- no --> L[Button: GitHub 로그인] -->|click| L2[PowerShell login window + Chrome tab, poll status every 3s] --> P
    C -- yes --> P[submit]
```

- `step` holds what the button shows: `""` (등록 / PR 제안), `busy`, `register`, `install`, `login`, `waitLogin`. A click on `install` or `login` resumes the chain; on `register` it reopens the guide tab
- `chainId` is incremented by 취소 and 도우미 끄기, so a waiting loop ends instead of continuing an abandoned chain
- The rows are read at submit time, so edits made while the chain waited are included
- The last known login and push permission are kept in the page's `localStorage` only to label the button (등록 or PR 제안) before the helper runs again
- Scenario: Clean PC, helper registered, no GitHub CLI → click PR 제안 → button GitHub CLI 설치 → click → installed → button GitHub 로그인 → click → login window and tab → approved → pull request opened without another click
- All scenarios: [Dictionary Sync Scenarios](../../testing/scenarios/translation/30-dictionary-sync.md#register-chain-scenarios)

## Helper
- Code: `tools/dictionary-host.ps1` (native messaging host), `tools/register.ps1` (one-time registration), `editor/setup.html` and `editor/setup.js` (guide tab), `background.js` (port)
- Transport: Chrome native messaging (`nativeMessaging` permission). `background.js` holds the port, so the helper outlives the side panel; an open native port also keeps the service worker alive. Chrome closes the port, and the helper exits, when the extension stops or Chrome exits
- Requests, one at a time: `ping` (registration check, no GitHub call), `status` (`gh` found, `gh api user` login, push permission), `install` (`winget install GitHub.cli`), `login` (a PowerShell window running `gh auth login --web` with `GH_BROWSER` set to a no-op, because the editor opens github.com/login/device in a Chrome tab), `submit`
- `submit` checks the file (version 2, valid rows) and then uses only `gh api`:
  - Owner: reads the file's blob sha on `dictionary`, skips when the new content has the same git blob id, otherwise `PUT contents` with that sha
  - Others: `POST forks`, waits for the fork, creates `dictionary-update-<ms>` from the upstream `dictionary` head, commits the file there, and opens the pull request. An unchanged file deletes the new branch and reports no change
- Registration (`register.ps1`, ASCII only so it runs through `irm | iex`): saves the host and a launcher to `%USERPROFILE%\.udemy-dictionary-helper` and writes the registry key `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.udemy.dictionary_helper`. The launcher runs `powershell.exe -File "%~dp0dictionary-host.ps1"`, so a non-ASCII user folder name never goes into the ASCII batch file. It installs nothing
- `dictionary-host.ps1` is saved with a UTF-8 BOM. Windows PowerShell 5.1 reads a file without one in the system code page, which breaks its Korean login messages
- stdout carries the protocol, so the host writes diagnostics to stderr and discards every other output
- Scenario: User folder `C:\Users\シンジョンス` → `register.ps1` → the launcher holds only `%~dp0` → `ping` and `status` answer through Chrome's launch path

## Known Limits
- The owner path commits on top of the latest file. A change registered by someone else after the editor loaded is overwritten, because the editor does not send the sha it loaded
- The pull request path (fork, branch, pull request) has not been run end to end yet, because the owner's account cannot fork its own repository
- The Udemy page's Content Security Policy may block the cross-origin `fetch`. This is not yet verified on a Udemy page. If it is blocked, the bundled list is used and a warning is logged
- The remote file replaces the bundled list as a whole; the bundled list is used only when the remote file is unavailable
