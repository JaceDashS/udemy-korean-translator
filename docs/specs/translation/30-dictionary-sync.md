# Dictionary Sync

## Requirements
- Terms are read from the `dictionary` branch of this repository (`dictionary.json`, version 2) on each Udemy page load, so a change takes effect without reloading the extension
- The file is data only. It must be `{ "version": 2, "terms": [...] }`, with at most 10000 rows. Each row needs a word of at most 200 characters, may have a string meaning of at most 200 characters, and may have a boolean `exact` flag. Anything else is rejected
- If the download fails, times out (3 seconds), or the file is invalid, the terms bundled in `dictionary-terms.js` are used
- Registering happens only in the extension's side panel. The editor opened outside the extension is read-only. GitHub Pages is not used
- On the `dictionary` branch each term is its own file, `terms/<name>.json`. A GitHub Actions workflow on that branch rebuilds `dictionary.json` from the term files after every change (about a minute), so the extension keeps reading one file. A term file that is invalid or misnamed fails the build, and the previous `dictionary.json` stays in use
- Registering writes only the term files of added, changed, or removed terms. Terms changed by other people are never overwritten, and pull requests that change different terms never conflict with each other
- When someone else changed the same term since the editor loaded it, nothing is written. A new window lists each such term with both values (내 값, 최신 값); the user picks one per term and registering continues. Closing the window cancels registering and keeps the edits
- A contributor whose open pull request can no longer be merged (someone changed the same term) sees it in the side panel with 충돌 해결. It opens the same window; the pull request is rebuilt on the newest branch with the picks, or closed when nothing is left
- Leading and trailing spaces of a cell are removed when the cell loses focus
- The editor sends the changed term files to a local helper that uses the GitHub CLI (`gh`) login already on the PC. No token is stored in the browser or on a server. The helper needs only Windows PowerShell and GitHub CLI
- One click on 등록 / 등록 신청 runs the whole chain: helper registered → GitHub CLI installed → logged in → submit. A finished step goes straight on to the next check
- The chain stops only where the user must approve: installing GitHub CLI and logging in. The button then shows that step (GitHub CLI 설치, GitHub 로그인) and nothing runs until it is clicked
- The first time on a PC, the helper must be registered with Chrome once, outside Chrome. The editor opens a guide tab with a one-line command; the chain continues by itself once the helper answers
- When the installed helper is older than the one bundled in the extension, the chain stops and the button shows 도우미 업데이트. Its click replaces the helper and the chain continues. A helper too old to update itself is replaced by registering again (the guide tab opens)
- The helper keeps running in the background after the panel closes. It stops with 도우미 끄기, or when the extension is turned off or reloaded, or Chrome exits
- A user with push permission commits directly to the `dictionary` branch. The button reads 등록, and the status line says 등록 완료 with the short commit id
- Anyone else: the helper forks the repository, commits to a new branch, and opens a pull request to the `dictionary` branch. GitHub notifies the owner, who reviews and merges it. The button reads 등록 신청, and the status line says 등록 신청 완료 with a link to the pull request (신청 내용 보기)

Example:
- Input: Two people load the editor. One registers `agent`; the other registers `agentic` a minute later
- Result: Both terms are on the branch; neither registration overwrote the other
- Input: Editor types `private subnet` and `프라이빗 서브넷` in the top form, presses 추가, then 등록. A word alone (no meaning) is also accepted; a word already in the table is rejected
- Result: The new row is at the top of the table. After 등록, the branch commit `[chore] Update dictionary terms` contains it
- Result: The branch commit `[chore] Update dictionary terms` contains the new row. The next Udemy page load translates "private subnet" as 프라이빗 서브넷

- Design: [Dictionary Sync Design](../../design/translation/30-dictionary-sync.md#load-and-register)
- Guide: [Dictionary Editor](../../guides/10-dictionary-editor.md)
