# Pebble validation

Validated on macOS against implementation commit `8f5ff3c` on `cesdperez/pebble-session-companion`. The branch retains local main `03252f9` and its ten commits beyond `origin/main`. The approved document and both reference images were copied unchanged and committed first.

## Results

| Check | Result |
|---|---|
| `make test` | PASS: 28 Bun tests, three native C++ test executables, two Python USB bridge tests |
| `make validate-sim` | PASS: 24 deterministic native-window scenarios using the real shared firmware renderer, parser, gestures and input encoder |
| `make firmware` | PASS: PlatformIO ESP32-S3 compile, no upload; about 14.1% RAM and 13.1% application flash |
| `python3 tools/smoke_orca.py` | PASS: read-only Orca 1.4.232 metadata; 12 recent sessions, three working, one monitoring, seven live terminals at the time of the check |
| Sprite regeneration | Reproduces checked-in PNGs and indexed pixel rows without external dependencies |
| Final audit | Reference hashes intact, no build products staged, local main ancestry preserved, documentation and protocol checked together |

The smoke check reads `worktree ps` through the production reducer and checks complete terminal discovery. It prints only version/count metadata. It does not focus anything. Every navigation test uses a synthetic CLI or synthetic bundled native-chat runtime. No real user session was switched by validation.

Unit/native coverage includes multiple projects, Claude/Codex and terminal/native identities, siblings in a workspace, archived filtering, monitoring, failure outcomes, unknown outcomes, late result metadata, startup/reconnect completion baselines, acknowledgement, cue batching, stable page selections, exact host/workspace/tab/leaf focus, stale source checks after discovery, unavailable/unsupported targets, concurrent/duplicate requests, retry recovery, partial messages, malformed/oversized input, capacity bounds and receiver clock wraparound. A 90-session test reaches every card through bounded windows while retaining page selections.

The simulator additionally checks a 40-request list through position **36 / 40**, so crossing the 32-card transport window exercises actual UI input and rendering. It checks dragging away and back cannot open, priority changes preserve the original tap target, and a removed target cannot substitute another. A delayed-focus scenario changes pages mid-request, attempts a concurrent open, then confirms a later open reaches the selected monitoring session with its own receipt. The stale-link scenario stops incoming frames and attempts an Open after nine seconds; no input is emitted.

## Screenshots

These are native simulator captures of the shared RGB565 firmware UI. The round display is masked by the simulated bezel. Retina capture includes the simulator controls below it. They are implementation evidence, separate from the approved concept art.

| Capture | Evidence |
|---|---|
| [Home](validation/home.png) | Explicit attention count, subdued work/monitoring summary, exact session identity and Open action |
| [Attention](validation/attention.png) | Input label/icon, reason, previous/next targets and position |
| [Sessions](validation/sessions.png) | Independent session browser and page indicator |
| [Working](validation/working.png) | Head-down work-tile pose and Working label |
| [Monitoring](validation/monitoring.png) | Separate Monitoring state and bars |
| [Finished](validation/finished.png) | Observed completion, mint check, brief happy pose |
| [Failed](validation/failed.png) | Persistent explicit failure, mild concern |
| [Empty](validation/empty.png) | Deliberate no-active-or-recent-session message |
| [Disconnected](validation/disconnected.png) | Never-connected Status unknown, no fabricated last-update time, disabled Offline action |
| [Stale](validation/stale.png) | Connection lost, elapsed freshness, disabled action |
| [Failed focus](validation/failed-focus.png) | Actual negative navigation receipt becomes Retry open |
| [Long labels](validation/long-labels.png) | Fitted/ellipsized text inside the circular safe area |
| [Cross-page focus](validation/cross-page-focus.png) | Global pending lock and identity-bound Opened receipt after changing pages |
| [Bounded browsing](validation/bounded-window.png) | Position 36 / 40 beyond one transport window |

The retained captures were inspected for circular clipping, text legibility, button spacing, character silhouette and pixel scaling. The review corrected long text fitting, distinct poses, initial selection pinning and misleading never-connected freshness. Open/previous/next hit areas stay inside the circle. Sprites use integer scale and point filtering.

Additional reproducible captures in `sim/build/validation/` include All clear, confirmed focus, seen unresolved requests, intentional next request, unsupported native chat, unavailable terminal, disappearing target, stable selection and drag cancellation. [Summary and evidence hashes](validation/summary.json) identify the retained captures and run results.

Full transient outputs remain ignored:

- [Test output](../sim/build/validation/tests.log)
- [Scenario output](../sim/build/validation/scenarios.log), individual `<scenario>.log` files and all 24 screenshots
- [Firmware build output](../sim/build/validation/firmware-build.log), with binaries under `firmware/.pio/build/puck/`
- [Read-only live summary](../sim/build/validation/live-smoke.json)

Reproduce with `make test`, `make validate-sim`, `make firmware`, and, with Orca running, `python3 tools/smoke_orca.py`. Native windows and runtime access can require permission outside a process sandbox. Simulator tests never fall back to live Orca.

## Limits and hardware work

No physical puck was flashed or tested. The compile used the retained 1.75C pins, pioarduino Espressif32 55.3.312, Arduino-ESP32 3.3.12, Arduino_GFX 1.6.9 and SensorLib 0.3.4. Simulator success does not establish physical touch cadence, the 120 ms synthesized release interval, USB latency, AMOLED palette, dimming, frame rate or long-running board stability.

The companion is silent. Audio cues, mute, lift-to-wake, face-down mute and twist navigation are not implemented. Their intended calm policy remains documented as pending hardware work. The microphone and remote answering are outside scope.

Acknowledgement and page pins live in daemon memory. Restart baselines old completions and treats actionable requests as unseen. Restart the USB bridge after a device reconnect/reboot. The small bitmap font uses printable ASCII labels with truncation; Unicode typography is not implemented. Native chat focus depends on the installed macOS Orca runtime adapter; remote native chats are unsupported. Incomplete host coverage is reported as unavailable rather than a partial all-clear list.

No source-checkout files were changed, no shared skills were edited, and nothing was pushed, merged or uploaded. The worktree is clean apart from ignored simulator, Python cache and PlatformIO output directories.
