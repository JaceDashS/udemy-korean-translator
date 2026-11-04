# Dictionary

## Requirements
- Developer terms listed in the dictionary stay in English in the Korean translation, exactly as written in the source (casing and plural kept)
- Scope: Claude / Anthropic, AWS services, AWS concepts, and general development terms
- The longest matching term wins ("AWS Lambda function" over "AWS Lambda")
- Acronyms (no lowercase letters) and names listed as case-sensitive match only with exact casing, so ordinary words are still translated ("Sam", "lag", "haiku")
- A term inside another word is not matched ("subnetwork" is not "subnet")
- If the dictionary cannot be applied safely, the text is still translated without it; a translation is never left broken

Example:
- Input: "Attach an IAM role to the AWS Lambda function in a private subnet."
- Result: Korean sentence where `IAM role`, `AWS Lambda function`, `private subnet` stay English

- Design: [Dictionary Design](../../design/translation/20-dictionary.md#placeholder-substitution)
