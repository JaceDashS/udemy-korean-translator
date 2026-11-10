# Dictionary Editor

## Setup (once)
1. GitHub → Settings → Pages: Source "Deploy from a branch", branch `main`, folder `/ (root)`. The editor is then at `https://jacedashs.github.io/udemy-quiz-translator/editor/`
2. Create a fine-grained token: Settings → Developer settings → Personal access tokens → Fine-grained tokens. Repository access: only this repository. Permission: Contents → Read and write

## Use
1. Open the editor page and paste the token, then press 토큰 저장. The token stays in this tab only
2. Edit the table. Each row is one term:
   - 단어: the English word (required)
   - 뜻: the Korean meaning (optional). Leave it empty to keep the word in English
   - 대소문자 구분: check it for words that are ordinary English in lowercase (for example "haiku")
   To add one term, type it in the top form (단어 is required; 뜻 and 대소문자 구분 are optional) and press 추가 or Enter. The new row appears at the top. 행 추가 adds an empty row at the bottom. In a cell, Enter moves to the same column in the next row.
   To add many rows, copy them from a spreadsheet (단어 TAB 뜻 TAB Y) and paste into a 단어 cell
3. Press 등록. The table is committed to the `dictionary` branch
4. Reload a Udemy quiz page. The change applies on the next page load; the extension does not need a reload

## Propose a change (no token)
Anyone with a GitHub account can propose changes; the owner reviews them.
1. Edit the table and press 제안하기 (PR). The full file is copied and the fork page opens
2. Fork the repository once (uncheck "Copy the main branch only" so the `dictionary` branch is included)
3. In the fork, open `dictionary/dictionary.json` on the `dictionary` branch and press Edit. Replace the content with the copied text
4. Choose "Create a new branch for this commit and start a pull request" and press Propose changes
5. The owner gets the pull request. After review and merge, the change applies on the next Udemy page load

## Notes
- Only people with write access can register. Others can view the editor, but a token without write access cannot save changes
- Changing the bundled fallback (`dictionary-terms.js`) requires reloading the extension at chrome://extensions
