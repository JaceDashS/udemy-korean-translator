# Dictionary Editor

## Initial Download

Open the side panel and select 최신 단어장 받기. One successful server download is required before first use. Afterwards the dictionary works offline when the Chrome translation model is also available.

## Local Editing And Upload

Add a word and optional meaning. Empty meaning preserves English. Commit cell edits with Enter or by leaving the cell; saved changes apply locally immediately.

Select 사이트 계정으로 로그인. Existing website login, including Google, is reused. Upload requires the new-word upload grant or dictionary management access. Browser restart may require connecting again and preserves terms. Signed-out users can add local terms.

Select 업로드, clear the checkboxes for words you want to keep local and confirm. Local-only revisions stay excluded until edited or explicitly marked for sharing again.

## Conflicts

Expand a conflicted word to compare the local and public meanings. Fetch the latest public value if needed. Select 공개본 수정 검토 요청 or 로컬만 유지. Other selected uploads continue.

## Example Scenario

- Input: Your course translation is 과정 while the shared value is 강좌.
- Steps: Encounter a conflict and choose 로컬만 유지.
- Expected result: Your local value stays 과정, the shared value stays 강좌 and the draft stays out of the upload list.

- Design: [Dictionary Sync](../design/translation/30-dictionary-sync.md)
- Privacy: [Data Handling](30-data-handling.md)
