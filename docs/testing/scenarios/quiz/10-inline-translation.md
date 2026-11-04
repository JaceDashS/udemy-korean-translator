# Inline Translation Scenarios

## Inline Translation Scenarios
- Design: [Inline Translation](../../../design/quiz/10-inline-translation.md#layout-selection)
- All scenarios are manual checks on a Udemy quiz page (see [Test Strategy](../../10-strategy.md#manual-checks))

### Side Layout on a Wide Screen
- Input: Quiz column with at least 272px of free space right of the answers
- Steps: Translation finishes → `showInlineTranslations()`
- Result: Question and answer translations float to the right, the first answer translation aligned with its card

### Sidebar Is Not Covered
- Input: Main scroll container next to a curriculum sidebar
- Steps: `sideColumn()` uses the scroll container's right edge, even if it is not overflowing
- Result: The layer ends at the sidebar edge

### Fallback on a Narrow Screen
- Input: Less than 240px free width
- Steps: `sideColumn()` returns null
- Result: Translations are inserted directly below the question and each answer

### Switch on Resize
- Input: Window or sidebar width changes while a quiz is shown
- Steps: resize → `relayout()` → mode no longer fits → `showInlineTranslations()` with cached translations
- Result: Layout switches between side and below without a new translation call

### Follow Scroll
- Input: User scrolls the quiz
- Steps: capture scroll → `requestRelayout()` → `positionSide()`
- Result: Boxes keep the same offset from their originals; boxes scrolled out of the container are clipped

### Tall Translation
- Input: Question translation taller than the original question text
- Steps: `positionSide()` stacks boxes with an 8px gap
- Result: Boxes never overlap; later answer boxes may sit slightly lower than their cards
