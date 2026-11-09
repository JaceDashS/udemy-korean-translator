# Dictionary Editor

## Setup (once)
1. GitHub → Settings → Pages: Source "Deploy from a branch", branch `main`, folder `/ (root)`. The editor is then at `https://jacedashs.github.io/udemy-quiz-translator/editor/`
2. Create a fine-grained token: Settings → Developer settings → Personal access tokens → Fine-grained tokens. Repository access: only this repository. Permission: Contents → Read and write

## Use
1. Open the editor page and paste the token, then press 토큰 저장. The token stays in this tab only
2. Enter a word and its meaning, then press 추가 (Enter also works in the meaning box)
3. Press 등록. The change is committed to the `dictionary` branch
4. Reload a Udemy quiz page. The new pair applies on the next page load; the extension does not need a reload

## Notes
- Only people with write access can register. Others can view the editor, but a token without write access cannot save changes
- Changing the bundled fallback (`dictionary-terms.js`) requires reloading the extension at chrome://extensions
