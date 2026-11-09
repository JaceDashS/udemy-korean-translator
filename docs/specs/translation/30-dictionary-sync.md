# Dictionary Sync

## Requirements
- Word pairs (English word → Korean meaning) are read from the `dictionary` branch of this repository (`dictionary.json`) on each Udemy page load, so a change takes effect without reloading the extension
- The file is data only. It must be an object with a `pairs` map of short strings (at most 5000 entries, 200 characters per word or meaning); otherwise it is rejected
- If the download fails, times out (3 seconds), or the file is invalid, the pairs bundled in `dictionary-terms.js` are used
- Registering a change from the editor commits it to the `dictionary` branch
- Only people with write access to the repository can push to the branch. Anyone else can read it but cannot change it
- The registration token is kept only in the browser tab session and is sent only to the GitHub API

Example:
- Input: Editor adds `private subnet` → `프라이빗 서브넷` and presses 등록
- Result: The branch commit `[chore] Update dictionary pairs` contains the new pair. The next Udemy page load translates "private subnet" as 프라이빗 서브넷

- Design: [Dictionary Sync Design](../../design/translation/30-dictionary-sync.md#load-and-register)
- Guide: [Dictionary Editor](../../guides/10-dictionary-editor.md)
