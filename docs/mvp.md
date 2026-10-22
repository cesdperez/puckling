# Session companion completion criteria

The implementation follows the [approved Pebble design](pebble-design.md).

## Implemented and deterministically checked

- Home, Attention and Sessions on the actual shared 466 by 466 firmware renderer.
- Multiple unarchived projects, mixed agent types, sibling terminal/native sessions, productive work, monitoring, failure and completion outcomes.
- Explicit icons, readable labels, original pixel sprites and large Open/previous/next touch targets inside the circle.
- Horizontal page swipes, vertical card swipes, previous/next taps, and drag cancellation of taps.
- Observed completion alerts, startup/reconnect baselines and deliberate acknowledgement. Opening does not resolve requests.
- Active sessions plus a documented 24-hour result window, deterministic ordering and server-side browsing beyond the bounded transport window.
- Stable selected identities, unavailable targets, fresh-source revalidation, exact existing pane focus, duplicate suppression and receipt feedback.
- Bounded, versioned, partial-message-safe USB/PTY protocol, without prompts or terminal contents on the device or in logs.
- Empty, stale, disconnected, unsupported and retry states.

## Validation required before hardware release

- Flash only with explicit user authorization and verify touch report cadence, synthesized release, swipes, USB writes and exact focus on the physical **1.75C**.
- Check AMOLED color, clipping, dimming, frame rate and long-running stability on the device.
- Add and verify one soft audio cue per batched attention event, including mute. The current implementation is silent.
- Optional lift-to-wake, face-down mute and twist navigation follow the core hardware checks.

The current firmware compiles. Native simulator validation and a read-only live Orca metadata smoke check are recorded in [validation](validation.md). No physical puck was flashed or tested in this implementation session.
