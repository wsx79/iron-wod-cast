# IRON WOD Cast LED — Interval counter v2

Cast transport:
- `receiver.js` is unchanged and byte-identical to the working MirrorSafe receiver.
- No Cast API code was added to `led-display.js`.

Structured Intervals display:
- top: WORK (green) / REST (blue)
- main countdown: white
- left of countdown: current configured interval step in red, zero padded
  (`01`, `02`, `03`, ...)
- under the red number: `INTERVALLO` in orange
- old top `1/3` phase indicator is not used
- bottom generic footer is hidden while an interval badge is active

Audio:
- every change of `INTERVALLO n DI N` plays one short `sounds/countdown.mp3`
  alert, including WORK -> WORK transitions.
- no alert is played just because the configuration screen is visible.

Configuration:
- `CONFIGURA IL TIMER` is smaller and moved farther right.
