# Data Handling

## Local Processing

Quiz and caption text is processed by Chrome on the device, not automatically uploaded to the dictionary service. Terms and local modifications are saved on the device.

## Server Data

Downloads contact api.jace-s.com. Login opens the existing first party website login, including Google. The extension neither asks for nor transmits a password. A cookie and CSRF protected website connection delivers a separately revocable session through challenge checked external messaging; tokens never appear in URLs. Credentials remain in trusted extension session storage and disappear after the browser session ends.

Authorized uploads send saved pending dictionary entries. Automatic upload defaults on; disabling it keeps changes local until manual upload. Local only revisions are excluded until edited or explicitly queued again.

The platform stores dictionary entries, authenticated actor identity, timestamps, history, conflicts and choices for authorized developer inspection. Existing platform request and authentication logging also applies. Publication must provide a service privacy policy covering that actual handling and retention; this is not a claim that no user data is handled.

## Example Scenario

- Input: A logged in authorized user edits a term with automatic upload off.
- Steps: Save locally and later click manual upload.
- Expected result: The term is sent only at upload time, the server records the authenticated actor and no password is retained by the extension.

- Guide: [Dictionary Editor](10-dictionary-editor.md)
