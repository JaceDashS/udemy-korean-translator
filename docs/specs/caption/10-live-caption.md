# Live Caption

## Requirements
- On a Udemy lecture with English captions (CC), Korean captions appear over the video in real time
- Korean captions start by themselves once the translator is ready. A new PC that must download the model starts after the first click on the page
- The English caption is hidden only while its Korean text is shown, so a caption is never blank while it is being translated
- The button on the video (한국어 CC 끄기 × / 한국어 CC 시작) turns Korean captions off and on. Turning them off is remembered on this browser until they are turned on again
- Developer terms from the dictionary apply to captions the same way as to the quiz
- In native video fullscreen the overlay cannot be shown, so the English captions stay
- Udemy's caption DOM is never changed; only a class on `<html>` hides it and a separate overlay shows the Korean text

Example:
- Input: English caption "You can make sure you have really understood everything and you had memorized it."
- Result: Overlay shows "당신은 당신이 모든 것을 정말로 이해하고 그것을 암기했는지 확인할 수 있습니다." and the English caption is hidden

- Design: [Live Caption Design](../../design/caption/10-live-caption.md#caption-translation)
