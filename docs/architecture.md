# Architecture

Pebble is an Orca session companion. The [approved three-screen design](pebble-design.md) governs the product. The generated concept images remain references; production artwork is separate indexed pixel data.

```text
Orca worktree ps -> Bun daemon -> bounded JSON lines -> USB or raw PTY
                         ^                               |
                         | exact identity + request      v
                  focus receipt <- existing tab/pane <- shared firmware UI
```

## Ownership

The daemon owns session identities, metadata filtering, active/recent inclusion, ordering, attention events, acknowledgement, browsing windows, and focus revalidation. Firmware renders snapshots and owns responsive page, selection, gesture, animation, and pending-action state. No transcript or prompt is sent to the device.

The daemon retains all sessions from a complete cross-host query of unarchived workspaces. Every snapshot transports at most 32 cards. Server-side stepping traverses the entire ordered list. The three selected identities are pinned into subsequent windows, so changing priorities or moving far through a long list cannot evict another page's selected card. Missing identities remain unavailable until deliberate navigation.

A complete snapshot arrives every two seconds and after input receipts. The source age is separate from transport arrival time. An action receipt cannot make old Orca data fresh. Incomplete host coverage is an outage, never an empty list. See [protocol](protocol.md).

## Implementation choices

- **Bun/TypeScript daemon:** subprocess calls, metadata reduction and tests without package dependencies. Acknowledgements are in memory. Restart/reconnect baselines old completions; requests remain actionable.
- **USB serial:** the existing standard-library Python bridge stays in place, with partial writes and bounded queues. The simulator's raw PTY carries the same duplex protocol.
- **Arduino_GFX renderer:** the lightweight renderer draws text, flat surfaces, icons and integer-scaled indexed sprites. No UI framework dependency was needed. Hardware draws at up to 15 frames per second. The desktop shim implements the same primitives against an RGB565 framebuffer.
- **Shared UI:** `firmware/src/ui.cpp` and `session.cpp` run unchanged in the native raylib simulator and ESP32 build. Sensor/display drivers stay outside the simulator.
- **Original sprites:** `tools/build_sprites.py` encodes authored polygons on a 64 by 44 logical grid and emits PNG previews plus checked-in pixel rows. Runtime rendering reads those assets, not procedural shapes or the concept board. See [art provenance](creature.md).
- **Exact focus adapters:** existing terminal-handle and local native-chat adapters are retained. The daemon refreshes discovery, checks the selected identity, and validates the receipt. It never creates a tab.
- **Board support:** CO5300, CST9217 and QMI8658 configuration remains specific to the Waveshare 1.75C. Continuous touch reports feed the shared gesture recognizer. Quiet interrupt gaps synthesize release when the controller omits a release report.

## Validation boundary

`make test` checks business state, framing, freshness, exact navigation, gestures and the USB bridge. `make validate-sim` drives real shared rendering/input through a synthetic Orca daemon and PTY. `make firmware` compiles without uploading. Simulator success cannot establish sensor timing, audio, brightness, physical USB responsiveness or display frame rate. See [validation](validation.md).

Audio, lift-to-wake, face-down mute and twist control are pending. The UI remains fully usable silently. There is no pet-care or transcript ingestion subsystem.
