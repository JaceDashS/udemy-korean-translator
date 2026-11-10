# Dictionary Editor

The editor is at `https://jacedashs.github.io/udemy-quiz-translator/editor/`. Saving needs a local helper that runs on your PC. The helper uses your own git and gh logins, so no token is stored in the browser or on a server.

## Setup (once per PC)
1. Install Node.js 18 or later, git, and GitHub CLI (`gh`).
2. Run `gh auth login` in a terminal. When asked, allow Git operations with your GitHub credentials.
3. Clone the repository and start the helper:
   ```
   git clone https://github.com/JaceDashS/udemy-quiz-translator.git
   cd udemy-quiz-translator
   node tools/dictionary-helper.js
   ```
   Keep this window open while you edit. It listens only on `127.0.0.1:8787`.
4. Open the editor page. The top line should show "도우미 연결됨" with your login.

## Edit
Each row is one term:
- 단어: the English word (required)
- 뜻: the Korean meaning (optional). Leave it empty to keep the word in English
- 대소문자 구분: check it for words that are ordinary English in lowercase (for example "haiku")

To add one term, type it in the top form (단어 is required) and press 추가 or Enter. The new row appears at the top. 행 추가 adds an empty row at the bottom. In a cell, Enter moves to the same column in the next row.

To add many rows, copy them from a spreadsheet (단어 TAB 뜻 TAB Y) and paste into a 단어 cell.

## Submit
The button shows one of two actions, depending on your GitHub permission:
- **등록** (repository owner): commits the table straight to the `dictionary` branch.
- **PR 제안** (anyone else): the helper forks the repository once, commits your change to a new branch on your fork, and opens a pull request to `dictionary`. The status line links to the pull request.

After the owner merges a change, it applies on the next Udemy quiz page load. The extension does not need a reload.

## Notes
- The first submit may ask Chrome for permission to reach devices on your local network. Allow it, or the editor cannot reach the helper.
- The helper runs the commands `git` and `gh` only, and only for this repository.
- Changing the bundled fallback (`dictionary-terms.js`) requires reloading the extension at chrome://extensions.
