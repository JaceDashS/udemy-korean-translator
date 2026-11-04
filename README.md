# Udemy Quiz Translator (Chrome)

Chrome 내장 Translator API (영어 → 한국어)를 사용해 Udemy 시험 문제, 선택지, 정답/오답 및 해설을 자동 번역합니다.

## 새 PC에 설치

1. ZIP을 압축 해제합니다. `manifest.json`과 `content.js`가 한 폴더에 있어야 합니다.
2. 데스크톱 Chrome 138 이상에서 `chrome://extensions`를 엽니다.
3. 오른쪽 위 **개발자 모드**를 켭니다.
4. **압축해제된 확장 프로그램을 로드합니다**를 눌러 `udemy_local_translator` 폴더를 선택합니다.
5. Udemy 퀴즈 페이지를 열거나 새로고침합니다.
6. 번역이 자동으로 시작됩니다. 새 PC에서 언어 모델이 아직 없으면, 페이지를 한 번 클릭하면 다운로드가 시작됩니다(진행률은 DevTools 콘솔에 표시).

## 동작

- 화면에 별도 패널이나 버튼이 없습니다. 번역은 원래 문제와 각 선택지 바로 아래에 인라인으로 표시됩니다.
- 퀴즈가 변경되면 MutationObserver로 자동 갱신합니다.
- 오류와 상태는 DevTools 콘솔에 `[Udemy Local Translator]`로 출력됩니다.

## 특성

- 별도 번역 API 키, 계정, 유료 서버 필요 없음.
- Chrome 내장 번역 모델 사용. 처음에는 모델 다운로드가 필요할 수 있습니다.
- 원래 문제/선택지는 수정하지 않고 그 아래에 번역을 추가로 표시합니다.
- 정답/오답 피드백 및 해설도 번역을 시도합니다.
- `manifest.json`에서 허용한 Udemy 사이트에서만 실행합니다.

## 알려진 한계

- Udemy가 HTML 구조를 바꾸거나 다른 유형의 퀴즈로 이동하면 인식이 실패할 수 있습니다.
- 실제 Udemy 계정 환경에서 모든 유형의 퀴즈를 검증하지 못했습니다.
- 메인 페이지의 HTML에서 조작되므로 다른 창/iframe 내부 문제는 지원하지 않습니다.
- Chrome 데스크톱 버전 138 이상 필요하며 브라우저의 내장 모델/언어 지원에 영향을 받습니다.
- 확장 프로그램은 로컬 압축해제 설치이므로 다른 PC에도 각자 설치해야 합니다.

## 개발자 진단

Udemy 페이지 DevTools 콘솔에서:

```js
window.udemyLocalTranslator.start()
window.udemyLocalTranslator.refresh()
window.udemyLocalTranslator.destroy()
```

## 문서

- https://developer.chrome.com/docs/ai/translator-api
- https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts
