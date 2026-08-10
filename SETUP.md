# IRON WOD Custom Web Receiver — one-time setup

The Android sender is already wired to publish only `TimerProjectionState` over:

`urn:x-cast:com.example.crossboxpro.timer`

The remaining Google Cast requirement is external to the APK:

1. Host `index.html`, `receiver.css` and `receiver.js` together on a public HTTPS URL.
2. In the Google Cast SDK Developer Console create a **Custom Receiver** pointing to that HTTPS `index.html` URL.
3. Copy the receiver **Application ID** assigned by Google.
4. Add this line to the project-level `gradle.properties` (do not add quotes):

   `IRON_CAST_APP_ID=YOUR_APP_ID`

5. Sync/Rebuild/reinstall IRON WOD. The Cast SDK reads the ID at build time.

If `IRON_CAST_APP_ID` is absent, IRON WOD deliberately falls back to Google's Default Media Receiver. Device discovery, connect/disconnect and reconnection continue to work, but the timer cannot be rendered because the default receiver does not run the IRON WOD receiver code.

## TV payload

The receiver gets JSON shaped like:

```json
{
  "type": "timer",
  "statusText": "WORK",
  "timerText": "02:31",
  "footerText": "ROUND 3 / 5",
  "accentColor": "#FF6D00"
}
```

or `{"type":"clear"}` when no timer board is active.
