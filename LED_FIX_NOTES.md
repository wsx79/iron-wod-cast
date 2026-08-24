# IRON WOD Cast LED — Fix

## Critical freeze fixed
The first LED experiment called `compactCompletionStatus()` after that helper had
accidentally been removed during the rendering refactor. The receiver therefore
loaded its static 00:00 screen but threw a JavaScript ReferenceError on the first
timer message.

The helper has been restored. `receiver.js` passes `node --check`.

## Structured Intervals visual
For statuses such as:
`WORK · FASE 1/3`

the Cast screen now renders:
- top-left: `1/3`
- top status: `WORK` or `REST`
- bottom: large `FASE`

The external `INTERVALLO` cycle label is intentionally not shown on Cast.
Other timer modes retain their normal footer behavior.
