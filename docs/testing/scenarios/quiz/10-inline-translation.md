# Inline Translation Scenarios

## Inline Translation Scenarios
- Design: [Inline Translation](../../../design/quiz/10-inline-translation.md#layout-selection)
- All scenarios are manual checks on a Udemy quiz page (see [Test Strategy](../../10-strategy.md#manual-checks))

### Side Layout on a Wide Screen
- Input: Quiz column with at least 272px of free space right of the answers
- Steps: Translation finishes → `showInlineTranslations()`
- Result: Question and answer translations float to the right, the first answer translation aligned with its card

### Centered Column Is Shifted
- Input: Quiz column centered by Udemy with wide empty space on both sides
- Steps: `shiftForSide()` → `centeredColumn()` → `applyShift()`
- Result: Original and translation are centered as a pair instead of the translation being squeezed against the right edge

### Shift Makes Side Layout Fit
- Input: Centered column whose right gap alone is under 272px, but left plus right gaps are enough
- Steps: `shiftForSide()` moves the column to a 24px margin → `sideColumn()` succeeds
- Result: Side layout instead of below

### Late Centering Is Detected
- Input: Translation rendered before Udemy finished centering the column (reported on a real page: original stayed centered, translation squeezed on the right)
- Steps: Udemy DOM change → `positionSide()` → `shiftIsStale()` finds a centered column that should be shifted → rebuild
- Result: Column shifts; mock check: class change to centered → margin-left applied after the debounce

### Dropped Override Is Reapplied
- Input: Udemy re-renders the column and removes the inline margin
- Steps: `shiftIsStale()` sees margin-left differs from the applied value → rebuild
- Result: Shift applied again

### Shift Is Restored
- Input: Side layout shown, then the column becomes too narrow, or `destroy()` is called
- Steps: `clearInlineTranslations()` or below fallback → `restoreShift()`
- Result: The column's inline margin values are back to what Udemy had

### Sidebar Toggle Recalculates the Shift
- Input: Side layout shown, user opens or closes Udemy's curriculum sidebar (no window resize)
- Steps: Udemy DOM changes → `requestRelayout()` → `positionSide()` sees a different container width → rebuild
- Result: Column margin is recalculated (mock: 443px → 24px → 443px)

### Boxes Taller Than the Quiz
- Input: Narrow side column, so the translations are taller than the original question and answers
- Steps: `positionSide()` sets the spacer height to the overflow below the last answer
- Result: The quiz container scrolls far enough to show every translation box

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
- Steps: resize → `requestFullRelayout()` → `showInlineTranslations()` with cached translations
- Result: Layout switches between side and below without a new translation call

### Follow Scroll
- Input: User scrolls the quiz
- Steps: capture scroll → `requestRelayout()` → `positionSide()`
- Result: Boxes keep the same offset from their originals; boxes scrolled out of the container are clipped

### Tall Translation
- Input: Question translation taller than the original question text
- Steps: `positionSide()` stacks boxes with an 8px gap
- Result: Boxes never overlap; later answer boxes may sit slightly lower than their cards
