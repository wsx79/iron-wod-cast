# IRON WOD Custom Web Receiver — setup

The Android sender publishes `TimerProjectionState` over:

`urn:x-cast:com.example.crossboxpro.timer`

Host `index.html`, `receiver.css`, `receiver.js` and the `voice/` directory together on the same public HTTPS origin used by the registered Google Cast Custom Receiver.

The Android sender already includes the audio preferences in each timer payload. No Android-side audio protocol change is required for this receiver patch.

## TV payload

The receiver accepts JSON shaped like:

```json
{
  "type": "timer",
  "statusText": "WORK",
  "statusBaseText": "WORK",
  "timerText": "02:31",
  "footerText": "ROUND 3 / 5",
  "timeCapText": "TIME CAP 15:00",
  "accentColor": "#FF6D00",
  "audioMode": "VOICE",
  "voiceLanguage": "es"
}
```

`audioMode` values:

- `VOICE` — play MP3 cues from `voice/<language>/`.
- `SOUNDS` — generate Cast-side acoustic beeps.
- `SILENT` — no Cast audio.

Supported `voiceLanguage` values are `it`, `en` and `es`. Region variants such as `es-ES` are reduced to their primary language code.

The voice folders must contain the same filenames for every language:

```text
voice/it/1.mp3 ... 10.mp3
voice/it/go.mp3
voice/it/work.mp3
voice/it/rest.mp3
voice/it/complete.mp3

voice/en/...
voice/es/...
```

The receiver announces preparation countdown values 1–10, GO after preparation, WORK/REST phase transitions and COMPLETE/finish. Duplicate timer-state updates do not replay the same cue. If a requested voice file cannot be loaded, the receiver falls back to an acoustic beep instead of remaining silent.

Use `{"type":"clear"}` when no timer board is active.

## GitHub Pages

For the current public receiver, keep the audio tree next to `receiver.js` under the repository root so relative URLs resolve as:

`https://wsx79.github.io/iron-wod-cast/voice/<language>/<cue>.mp3`

After pushing a receiver update, allow GitHub Pages/CDN a short time to refresh before testing on Chromecast.
