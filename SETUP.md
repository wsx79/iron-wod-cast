# IRON WOD Custom Web Receiver — one-time setup

The Android sender is already wired to publish only `TimerProjectionState` over:

`urn:x-cast:com.example.crossboxpro.timer`

The remaining Google Cast requirement is external to the APK:

1. Host `index.html`, `receiver.css` and `receiver.js` together on a public HTTPS URL.
2. In the Google Cast SDK Developer Console create a **Custom Receiver** pointing to that HTTPS `index.html` URL.
3. The registered IRON WOD receiver Application ID is `35E158B4`.
4. IRON WOD 8.1.2.1 already uses this ID by default: no manual `gradle.properties` edit is required.
5. Sync/Rebuild/reinstall IRON WOD and test on an authorized Cast receiver device.

Optional developer override: a project-level `IRON_CAST_APP_ID=XXXXXXXX` property still overrides the built-in ID for future receiver migrations or test receivers.

While the Cast application remains unpublished in the Google Cast SDK Developer Console, the custom receiver launches only on Cast devices explicitly registered for testing.

## TV payload

The receiver gets JSON shaped like:

```json
{
  "type": "timer",
  "statusText": "WORK",
  "timerText": "02:31",
  "footerText": "ROUND 3 / 5",
  "timeCapText": "TIME CAP 15:00",
  "accentColor": "#FF6D00"
}
```

or `{"type":"clear"}` when no timer board is active.


## Structured timer time cap

IRON WOD 9.0-D2 adds `timeCapText` as a separate optional payload field so WORK can stay green while TIME CAP is rendered in orange. HDMI receives this directly from the APK. For Chromecast, redeploy these updated receiver assets to the HTTPS URL registered for the Custom Receiver.
