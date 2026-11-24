# Changelog

## Version 3.1.3

- Caption translation looks ahead using the selected track or loaded transcript and keeps the translation visible across the corresponding cues. Live captions without punctuation fall back to a length limit at cue boundaries.
- Captions can use multiple source languages. Automatic detection and a manual language selector share the English quiz translator where applicable.
- Opt-in caption diagnostics show timings and sentence IDs in the extension without including transcript or translation text.
- Dictionary uploads use explicit word selection. A conflicting upload fetches the current public value and can request manager review while retaining the local edit.
- English automatic captions were verified in a 151-second Udemy playback. A single translation stayed visible across four consecutive transcript cues, and playback recovered from a brief switch to live cue mode. Other source languages were tested with simulated Chrome translation models.

[Build and verification](docs/guides/20-development.md#build-a-release)
