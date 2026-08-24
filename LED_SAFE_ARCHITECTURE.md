# LED mirror-safe receiver

Critical design rule:
`receiver.js` is byte-for-byte identical to the last known working
AudioMode/PayloadValidation receiver.

The LED UI is implemented in `led-display.js` as a MutationObserver mirror:
Android sender -> receiver.js -> hidden source DOM -> LED display.

`led-display.js` never:
- creates a CastReceiverContext
- registers a namespace
- receives a Cast message
- changes host sender state
- touches the audio pipeline
- writes to the source DOM used by receiver.js

This makes the visual layer unable to block the Cast timer update path.
