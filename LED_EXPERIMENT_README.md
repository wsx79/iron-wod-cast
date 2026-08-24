# IRON WOD Cast — LED Experimental Receiver

This experiment changes only the receiver presentation.

Kept unchanged:
- Cast namespace
- sender host lock / disconnect behavior
- audio pipeline and VOICE/SOUNDS/SILENT behavior
- payload validation
- legacy time-cap parsing
- current `voice/` and `sounds/` assets

New visual behavior:
- ROUND: blue, top-left
- WORK: green status + red seven-segment timer
- REST: blue status + blue seven-segment timer
- OTC: red status + red seven-segment timer
- FINISHED/COMPLETED: green status + white timer
- PREP: orange
- BLOCK: orange
- workout mode: grey
- TIME CAP: white below the large timer

The main numeric clock is rendered with pure HTML/CSS seven-segment digits.
No external font is required.

Rollback: restore the previous index.html / receiver.css / receiver.js.
