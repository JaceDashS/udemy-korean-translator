# Dictionary Sync

## Requirements
- Terms are read from the `dictionary` branch of this repository (`dictionary.json`, version 2) on each Udemy page load, so a change takes effect without reloading the extension
- The file is data only. It must be `{ "version": 2, "terms": [...] }`, with at most 10000 rows. Each row needs a word of at most 200 characters, may have a string meaning of at most 200 characters, and may have a boolean `exact` flag. Anything else is rejected
- If the download fails, times out (3 seconds), or the file is invalid, the terms bundled in `dictionary-terms.js` are used
- The editor sends the full file to a local helper (`tools/dictionary-helper.js`, listening on 127.0.0.1 only). The helper uses the git and gh logins already on the PC. No token is stored in the browser or on a server
- The helper accepts requests only from the editor origin (https://jacedashs.github.io) and checks that the file is version 2 before running git
- A user with push permission commits directly to the `dictionary` branch
- Anyone else: the helper forks the repository, commits to a new branch, and opens a pull request to the `dictionary` branch. GitHub notifies the owner, who reviews and merges it

Example:
- Input: Editor types `private subnet` and `프라이빗 서브넷` in the top form, presses 추가, then 등록. A word alone (no meaning) is also accepted; a word already in the table is rejected
- Result: The new row is at the top of the table. After 등록, the branch commit `[chore] Update dictionary terms` contains it
- Result: The branch commit `[chore] Update dictionary terms` contains the new row. The next Udemy page load translates "private subnet" as 프라이빗 서브넷

- Design: [Dictionary Sync Design](../../design/translation/30-dictionary-sync.md#load-and-register)
- Guide: [Dictionary Editor](../../guides/10-dictionary-editor.md)
