# Dictionary Editor

Click the extension icon in the Chrome toolbar; the editor opens in the side panel. Registering and proposing work only there. The GitHub Pages copy (`https://jacedashs.github.io/udemy-quiz-translator/editor/`) is read-only.

Saving uses a small helper on your PC that borrows your GitHub CLI (`gh`) login, so no token is stored in the browser or on a server. You do not set it up in advance: the 등록 / 등록 신청 button walks you through it the first time.

## First Submit on a New PC
One click on **등록 신청** (or **등록**) runs every step in order. It stops only where your approval is needed, and the button shows that step:

1. **Register the helper (once per PC).** A guide tab opens. Press **명령 복사**, open PowerShell (Windows key, type PowerShell, Enter), paste, and press Enter. When the window prints `Done.`, the tab and the editor continue by themselves. The command only saves the helper to `%USERPROFILE%\.udemy-dictionary-helper` and adds one registry key for Chrome; it installs nothing and needs no admin rights.
2. **GitHub CLI 설치** (only if gh is missing). Click it to install GitHub CLI with winget. Allow the Windows prompt if one appears.
3. **GitHub 로그인** (only if you are not logged in). Click it: a PowerShell window shows a one-time code, and a Chrome tab opens github.com/login/device. Press Enter in the window, enter the code in the tab, and approve.
4. The change is submitted right away; you do not click 등록 / 등록 신청 again.

Example:
- Input: New PC with Chrome and the extension only; one term added
- Steps: 등록 신청 → guide tab, paste the command → GitHub CLI 설치 → GitHub 로그인, approve in the tab
- Result: The status line links to the new pull request

Use **취소** to stop a waiting step. The helper keeps running in the background after you close the panel; **도우미 끄기** stops it. It also stops when the extension is turned off or reloaded, or Chrome exits.

## Edit
Each row is one term:
- 단어: the English word (required)
- 뜻: the Korean meaning (optional). Leave it empty to keep the word in English
- 대소문자 구분: check it for words that are ordinary English in lowercase (for example "haiku")

To add one term, type it in the top form (단어 is required) and press 추가 or Enter. The new row appears at the top. In a cell, Enter moves to the same column in the next row.

To add many rows, copy them from a spreadsheet (단어 TAB 뜻 TAB Y) and paste into a 단어 cell.

## Submit
The button shows one of two actions, depending on your GitHub permission:
- **등록** (repository owner): commits the table straight to the `dictionary` branch. The status line says **등록 완료**.
- **등록 신청** (anyone else): the helper forks the repository once, commits your change to a new branch on your fork, and opens a pull request to `dictionary`. The status line says **등록 신청 완료** and links to the pull request (신청 내용 보기).

After the owner merges a change, it applies on the next Udemy quiz page load. The extension does not need a reload.

## Notes
- The helper runs `gh` only (and `winget` for the GitHub CLI install), and only for this repository.
- The register script can be read before you run it: `tools/register.ps1` in this repository.
- Changing the bundled fallback (`dictionary-terms.js`) requires reloading the extension at chrome://extensions.
