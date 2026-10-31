# Udemy Local Quiz Translator (Chrome)

Chrome 내장 Translator API (영어 → 한국어)를 사용해 Udemy 시험 문제, 선택지, 정답/오답 및 해설을 자동 번역합니다.

## 새 PC에 설치

1. ZIP을 압축 해제합니다. `manifest.json`과 `content.js`가 한 폴더에 있어야 합니다.
2. 데스크톱 Chrome 138 이상에서 `chrome://extensions`를 엽니다.
3. 오른쪽 위 **개발자 모드**를 켭니다.
4. **압축해제된 확장 프로그램을 로드합니다**를 눌러 `udemy_local_translator` 폴더를 선택합니다.
5. Udemy 퀴즈 페이지를 열거나 새로고침합니다.
6. 오른쪽 아래 **번역 열기**를 누릅니다. 새 PC에서는 언어 모델이 처음 다운로드될 수 있습니다.

## 조작

- **⋮⋮ 제목 표시줄 드래그:** 패널 이동
- **오른쪽 아래 모서리 드래그:** 너비/높이 조절
- **− / □:** 최소화/복원
- **×:** 닫기. 오른쪽 아래 **번역 열기**로 언제든 다시 열 수 있음
- **↻:** 번역 재확인
- 위치와 크기는 Udemy 도메인의 로컬 저장소에 보존됩니다.
- 퀴즈가 변경되면 MutationObserver로 자동 갱신합니다.

## 특성

- 별도 번역 API 키, 계정, 유료 서버 필요 없음.
- Chrome 내장 번역 모델 사용. 처음에는 모델 다운로드가 필요할 수 있습니다.
- 원래 문제/선택지는 수정하지 않고 별도 패널에 번역을 표시합니다.
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
window.udemyLocalTranslator.open()
window.udemyLocalTranslator.refresh()
window.udemyLocalTranslator.close()
window.udemyLocalTranslator.destroy()
```

## 문서

- https://developer.chrome.com/docs/ai/translator-api
- https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts
