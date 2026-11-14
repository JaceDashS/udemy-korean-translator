> Archived 2026-11-14: Replaced by on premises dictionary synchronization. See [Current document](../../../../testing/scenarios/translation/30-dictionary-sync.md).

# Archived Dictionary Sync Scenarios

## Dictionary Sync Scenarios
- Design: [Dictionary Sync Design](../../../design/translation/30-dictionary-sync.md#load-and-register)

### Remote Terms Loaded
- Input: `dictionary.json` with `terms` = `[{ "word": "private subnet", "meaning": "프라이빗 서브넷" }]`
- Steps: Open a Udemy quiz with "a private subnet"
- Result: Console shows "Loaded 1 dictionary terms." and the translation contains `프라이빗 서브넷`
- Test: Manual on a Udemy quiz page (not automated)

### Download Fails
- Input: Network error, HTTP 404, or no response within 3 seconds
- Steps: `loadGlossary()` catches the error
- Result: Console warns "Using the bundled dictionary terms."; translation continues with the bundled list
- Test: Manual (block the URL in DevTools)

### Invalid File
- Input: `dictionary.json` with `version` other than 2, `terms` not an array, or a row without a string `word`
- Steps: `isValidTerms()` returns false
- Result: The file is rejected; the bundled list is used
- Test: Manual

### Edge Spaces Trimmed in the Editor
- Input: The user types `IAM role ` (trailing space) in a word cell or the new-word box
- Steps: While typing, the space stays, so `IAM role` can be typed; leaving the cell fires `change` → `trimInput()`
- Result: The cell shows `IAM role`; duplicate highlighting and the summary use the trimmed word
- Test: Manual in the side panel

## Term File Scenarios
- Design: [Term Files](../../../design/translation/30-dictionary-sync.md#term-files)

### Stable Case Safe File Names
- Input: Words `IAM role`, `SAM`, `sam`, `/compact`, `한국어`
- Steps: `fileName()`
- Result: `terms/iam-role-<hash>.json`; `SAM` and `sam` differ; `/compact` → `terms/compact-<hash>.json`; `한국어` → `terms/term-<hash>.json`; the same word always gives the same name
- Test: `term-files.test.js` → "file names are stable, readable, and differ by case"

### Lossless Conversion
- Input: The `dictionary` branch's `dictionary.json` with 1,590 terms (2026-11-10)
- Steps: `build-dictionary.js split` → `verify` → `build`
- Result: 1,590 files, 0 missing, 0 extra; the rebuilt `dictionary.json` is byte-identical; every stored blob id equals the editor's `blobSha(fileContent(term))`
- Test: `term-files.test.js` → "split then build gives back the same dictionary.json" (small sample); the full run is manual, before the push

### Invalid Term File Fails the Build
- Input: A term file under the wrong name, or with an unknown key
- Steps: The workflow runs `build`
- Result: The run fails and `dictionary.json` is not changed; the extension keeps the previous terms
- Test: `term-files.test.js` → "build rejects a file stored under the wrong name"

### Different Terms at the Same Time
- Input: A and B load the editor. A registers `agent`; B registers `agentic` a minute later
- Steps: B's helper reads the newest head; the blob id of `agentic`'s file equals B's base (absent) → pending → commit on top of A's commit
- Result: Both terms are on the branch. As pull requests, both can be merged with GitHub's merge button in any order
- Test: Manual after the push

### Same Term Changed by Someone Else
- Input: The owner loads `agent` (no meaning); someone else registers `agent` = 에이전트; the owner then sets `agent` = 대리자 and registers
- Steps: Branch blob id differs from base → conflict → nothing written → the window shows 내 값 대리자 and 최신 값 에이전트
- Result: 내 값 → committed as 대리자. 최신 값 → the table shows 에이전트 and nothing is left to send. Closing the window → registering is cancelled and the edit stays
- Test: Manual after the push

### Push Lands Between Check and Write
- Input: Another commit moves `dictionary` after the helper read the head
- Steps: The non-force ref update is refused → the helper reads the new head and checks again
- Result: The change is committed on top of the other commit; after 3 refusals the status says to try again
- Test: Manual (not reproducible on demand)

### Conflicted Contributor Pull Request
- Input: Y's open pull request changes `agent`; the owner then changes `agent` directly
- Steps: Panel opens → `proposals` → `mergeable` false → 충돌 해결 → window with the conflicted terms → `updateProposal`
- Result: The pull request is rebuilt on the newest branch with Y's picks and becomes mergeable, or is closed with a comment when nothing is left
- Test: Manual (needs a second account)

## Register Chain Scenarios
- Design: [Register Chain](../../../design/translation/30-dictionary-sync.md#register-chain)

### Ready PC Submits in One Click
- Input: Helper registered, gh installed and logged in as the owner; one row added
- Steps: Click 등록 → `ping` → `status` (ghAuth, canPush) → `submit`
- Result: New commit `[chore] Update dictionary terms` on `dictionary`; the status line shows the short commit id
- Test: Manual (not yet run)

### Unchanged File
- Input: The rows equal the file on `dictionary`
- Steps: `submit` → blob id of the new content equals the file's sha
- Result: No commit; the status line says 변경된 내용이 없습니다. For a proposal, the new branch on the fork is deleted
- Test: Manual (not yet run; it calls the real GitHub API)

### First Use Needs Registration
- Input: Host not registered (Chrome answers "Specified native messaging host not found.")
- Steps: Click 등록 신청 → guide tab opens, button shows 등록 안내 다시 열기 → user runs the command → `ping` answers
- Result: The chain goes on to the GitHub CLI check without another click; the guide tab shows 등록됐습니다
- Test: Manual (not yet run)

### Outdated Helper Updates on a Click
- Input: Installed helper reports `version` 1; the extension bundles `$HostVersion = 2`
- Steps: Click 등록 → `ping` answers 1 → button 도우미 업데이트 → click → `update` with the bundled script → host writes it and exits → `ping` answers 2
- Result: The chain continues to the GitHub CLI check; the installed file keeps the UTF-8 BOM
- Test: Manual with a stdin frame script (host part passed 2026-11-10: v1 → v2, BOM kept, exit after answer). The editor button is not yet run in the extension

### Helper Too Old to Update Itself
- Input: Installed helper answers `Unknown request.` to `ping` (before versions) or to `update` (version-less ping)
- Steps: The chain opens the guide tab → user registers again → editor and tab stop the old process before each `ping` → a helper of the bundled version answers
- Result: The chain continues; the tab shows 등록됐습니다 only when the new version answers
- Test: Host part checked 2026-11-10 (the version-less copy answered `Unknown request.` to `update`). Not yet run in the extension

### Invalid Update Is Rejected
- Input: `update` with content that has no `$HostVersion = N` line
- Steps: `Update-Host` checks the content
- Result: Error "The update is not a dictionary host script."; the installed file is unchanged
- Test: Manual with a stdin frame script (passed 2026-11-10)

### GitHub CLI Missing
- Input: Registered; gh not installed
- Steps: Chain stops at GitHub CLI 설치 → click → `install` (winget) → `status`
- Result: Nothing is installed before the click; after the install the chain checks the login at once
- Test: Manual (not yet run)

### Not Logged In
- Input: gh installed, not logged in
- Steps: Chain stops at GitHub 로그인 → click → PowerShell login window and a github.com/login/device tab → user approves → `status` polled every 3 seconds sees the login
- Result: The change is submitted without clicking 등록 / 등록 신청 again. Without approval in 10 minutes, the button returns to GitHub 로그인
- Test: Manual (not yet run)

### Cancel or Turn Off While Waiting
- Input: The chain waits at registration, install, or login
- Steps: Click 취소 or 도우미 끄기 → `chainId` changes
- Result: The waiting loop ends; the button returns to 등록 / 등록 신청. 도우미 끄기 also stops the helper process
- Test: Manual (not yet run)

### Helper Outlives the Panel
- Input: The helper ran a request; the side panel is closed and opened again
- Steps: `background.js` still holds the port → `state` answers running
- Result: The status line shows 도우미 실행 중. Turning the extension off ends the helper process
- Test: Manual (not yet run)

### Host Answers Through Chrome Launch Path
- Input: User folder `C:\Users\シンジョンス`; `register.ps1` run from the checkout
- Steps: The launcher `dictionary-helper-host.bat` is started with a native messaging `ping` / `status` frame on stdin
- Result: `status` answers `{ gh: true, ghAuth: true, login: "JaceDashS", canPush: true }`; the host exits when stdin closes
- Test: Manual with a stdin frame script (passed 2026-11-10)
