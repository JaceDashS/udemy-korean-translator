# Dictionary Editor

The editor is at `https://jacedashs.github.io/udemy-quiz-translator/editor/`. Saving needs a local helper that runs on your PC. The helper uses your own git and gh logins, so no token is stored in the browser or on a server.

## Setup (once per PC)
1. Open the editor page. If the helper is not running, the setup panel appears.
2. Press **준비 명령 복사** (copy setup command). The panel shows which tools were found (git, gh, gh login).
3. Open PowerShell, paste the command, and press Enter. The script:
   - checks Node.js 18+, git, and GitHub CLI (`gh`), and asks before installing any that are missing (through winget);
   - runs `gh auth login` if you are not logged in, and sets up Git authentication;
   - downloads `tools/dictionary-helper.js` to `%USERPROFILE%\.udemy-dictionary-helper` and starts it.
4. Keep that PowerShell window open while you edit. It listens only on `127.0.0.1:8787`. Stop it with Ctrl+C.
5. Refresh the editor page. The top line should show "도우미 연결됨" with your login.

The command only downloads and runs the script from this repository's `tools/setup.ps1`. Read it first if you want to check what it does.

## Edit
Each row is one term:
- 단어: the English word (required)
- 뜻: the Korean meaning (optional). Leave it empty to keep the word in English
- 대소문자 구분: check it for words that are ordinary English in lowercase (for example "haiku")

To add one term, type it in the top form (단어 is required) and press 추가 or Enter. The new row appears at the top. In a cell, Enter moves to the same column in the next row.

To add many rows, copy them from a spreadsheet (단어 TAB 뜻 TAB Y) and paste into a 단어 cell.

## Submit
The button shows one of two actions, depending on your GitHub permission:
- **등록** (repository owner): commits the table straight to the `dictionary` branch.
- **PR 제안** (anyone else): the helper forks the repository once, commits your change to a new branch on your fork, and opens a pull request to `dictionary`. The status line links to the pull request.

After the owner merges a change, it applies on the next Udemy quiz page load. The extension does not need a reload.

## Open in the Chrome side panel
The extension (version 1.6.0 or later) opens the same editor in the side panel. Click the extension icon in the Chrome toolbar. After updating the extension, reload it once at chrome://extensions.

## Notes
- The first submit may ask Chrome for permission to reach devices on your local network. Allow it, or the editor cannot reach the helper.
- The helper runs the commands `git` and `gh` only, and only for this repository.
- Changing the bundled fallback (`dictionary-terms.js`) requires reloading the extension at chrome://extensions.
