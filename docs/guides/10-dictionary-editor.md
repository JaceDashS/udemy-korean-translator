# Dictionary Editor

## Initial Download

Open the side panel and select 최신 단어장 받기. One successful server download is required before first use. Afterwards the dictionary works offline when the Chrome translation model is also available.

## Local Editing And Upload

Add a word and optional meaning. Empty meaning preserves English. Commit cell edits with Enter or by leaving the cell; saved changes apply locally immediately.

Select 사이트 계정으로 로그인. Existing website login, including Google, is reused; the extension does not ask for a password. Only Admin or an account with Translator dictionary and upload write access can upload. Browser restart may require connecting again but preserves terms. Signed out users may add local terms.

Automatic upload defaults on. Turn it off to retain local changes until 지금 업로드. Local only revisions remain excluded until edited or explicitly marked for sharing again.

## Conflicts

Expand a conflicted word to compare meanings, the server writer and time. Choose 내 번역 업로드, 서버 번역 사용, 로컬만 유지 or 나중에 결정. Other uploads continue. Another concurrent server change requires another choice.

## Example Scenario

- Input: Your course translation is 과정 while the shared value is 강좌.
- Steps: Encounter a conflict and choose 로컬만 유지.
- Expected result: Your local value stays 과정, the shared value stays 강좌 and automatic upload skips that local revision.

- Design: [Dictionary Sync](../design/translation/30-dictionary-sync.md)
- Privacy: [Data Handling](30-data-handling.md)
