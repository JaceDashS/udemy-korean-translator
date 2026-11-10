# Dictionary Sync

## Requirements
- Terms are read from the `dictionary` branch of this repository (`dictionary.json`, version 2) on each Udemy page load, so a change takes effect without reloading the extension
- The file is data only. It must be `{ "version": 2, "terms": [...] }`, with at most 10000 rows. Each row needs a word of at most 200 characters, may have a string meaning of at most 200 characters, and may have a boolean `exact` flag. Anything else is rejected
- If the download fails, times out (3 seconds), or the file is invalid, the terms bundled in `dictionary-terms.js` are used
- Registering a change from the editor commits the whole table to the `dictionary` branch
- Only people with write access to the repository can push to the branch. Anyone else can read it but cannot change it
- The registration token is kept only in the browser tab session and is sent only to the GitHub API

Example:
- Input: Editor adds a row `private subnet` with meaning `프라이빗 서브넷` and presses 등록
- Result: The branch commit `[chore] Update dictionary terms` contains the new row. The next Udemy page load translates "private subnet" as 프라이빗 서브넷

- Design: [Dictionary Sync Design](../../design/translation/30-dictionary-sync.md#load-and-register)
- Guide: [Dictionary Editor](../../guides/10-dictionary-editor.md)
