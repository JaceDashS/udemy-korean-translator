# Dictionary Scenarios

## Dictionary Scenarios
- Design: [Dictionary Design](../../../design/translation/20-dictionary.md#placeholder-substitution)

### Protect and Restore
- Input: "Launch an EC2 instance in a private subnet with an IAM role."
- Steps: `protect()` → translate → `restore()`
- Result: Terms `EC2`, `instance`, `private subnet`, `IAM role` stay English
- Test: `tests/dictionary.test.js` → "replaces terms with placeholders and restores the original text"

### Longest Match
- Input: "Use AWS Lambda function URLs." / "Use AWS Lambda with an IAM role."
- Steps: `protect()`
- Result: `AWS Lambda function` in the first; `AWS Lambda` and `IAM role` in the second
- Test: "prefers the longest matching term"

### Plural and Casing
- Input: "Two Security Groups and three VPCs."
- Steps: `protect()`
- Result: `Security Groups`, `VPCs` kept as written
- Test: "keeps plural and original casing"

### Acronym Versus Ordinary Word
- Input: "Sam noticed lag after deploying with SAM."
- Steps: `protect()`
- Result: Only `SAM` is protected
- Test: "acronyms match case-sensitively"

### Case Sensitive Names
- Input: "I wrote a haiku about my projects." / "Claude Haiku in Projects"
- Steps: `protect()`
- Result: Nothing protected in the first; `Claude`, `Haiku`, `Projects` in the second
- Test: "case-sensitive names ignore lowercase words"

### No Match Inside Words
- Input: "The subnetwork is ok." / "Use SQSX now."
- Steps: `protect()`
- Result: Nothing protected
- Test: "does not match inside other words"

### Line Breaks
- Input: "Configure a  private" + newline + "subnet."
- Steps: `protect()`
- Result: The two-line `private subnet` is protected as one term
- Test: "matches terms across line breaks and extra spaces"

### Existing Placeholder Syntax
- Input: "Value [[0]] with an EC2 instance"
- Steps: `protect()`
- Result: Dictionary skipped, text unchanged
- Test: "leaves text with existing placeholder syntax untouched"

### Lost Placeholder
- Input: Translation "[[0]]만 남음" for terms `EC2`, `S3`
- Steps: `restore()` returns `null` → `translateWithDictionary()` translates the plain source
- Result: A plain translation is shown, never a broken one
- Test: "restore returns null when a placeholder is lost"

### Extra Brackets From Translator
- Input: "[[[0]]에서 [[1]]]" (observed on Chrome 157)
- Steps: `restore()`
- Result: "Auto Scaling group에서 EC2" with no stray brackets
- Test: "restore absorbs extra brackets added by the translator"

### Spacing and Repeats
- Input: "[[ 0 ]]와 [[0]]"
- Steps: `restore()`
- Result: "S3와 S3"
- Test: "restore accepts spacing inside brackets and repeated placeholders"
