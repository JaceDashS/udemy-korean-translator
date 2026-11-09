# Dictionary Sync Scenarios

## Dictionary Sync Scenarios
- Design: [Dictionary Sync Design](../../../design/translation/30-dictionary-sync.md#load-and-register)

### Remote Pairs Loaded
- Input: `dictionary.json` with `pairs` = `{ "private subnet": "프라이빗 서브넷" }`
- Steps: Open a Udemy quiz with "a private subnet"
- Result: Console shows "Loaded 1 dictionary pairs." and the translation contains `프라이빗 서브넷`
- Test: Manual on a Udemy quiz page (not automated)

### Download Fails
- Input: Network error, HTTP 404, or no response within 3 seconds
- Steps: `loadGlossary()` catches the error
- Result: Console warns "Using the bundled dictionary pairs."; translation continues with bundled pairs
- Test: Manual (block the URL in DevTools)

### Invalid File
- Input: `dictionary.json` with `pairs` as an array, or a value that is not a string
- Steps: `isValidPairs()` returns false
- Result: The file is rejected; bundled pairs are used
- Test: Manual

### Editor Register
- Input: Editor adds one pair and presses 등록 with a valid token
- Steps: `register()` → PUT with `sha`
- Result: New commit `[chore] Update dictionary pairs` on `dictionary`; the editor shows the success message
- Test: Manual

### Editor Conflict
- Input: Branch changed after the editor loaded; 등록 pressed
- Steps: PUT returns 409
- Result: Error "다른 변경이 먼저 등록되었습니다"; nothing is overwritten
- Test: Manual
