# Puck protocol

The daemon writes one JSON object per line to stdout and reads input events from stdin. `sim/live.py` connects both streams to a raw pseudo-terminal; the simulator opens its slave at 115200 baud for reading and writing. `daemon/serial.py` connects the same streams to the puck's USB serial port at 115200 baud in raw mode. Every poll sends a complete snapshot, so a receiver can join at any time.

The puck reports plain-text diagnostic lines on the same port. The serial bridge prints these to stderr, and the daemon's input parser ignores them. The bridge handles partial writes in both directions, limits pending data to 64 KiB per direction, and stops its daemon when the live command exits or the USB connection fails.

```json
{"version":1,"type":"state","state":"working","connected":true}
```

State snapshots in version 1 have four required fields:

- `version`: integer `1`.
- `type`: string `state`.
- `state`: `idle`, `working`, `needs_me`, or `just_finished`.
- `connected`: whether the latest Orca query succeeded and covered every requested worktree and host.

The receiver retains the last valid snapshot when a line is malformed or has an unsupported version. Lines are limited to 255 bytes excluding the newline. Version 1 uses unescaped ASCII keys and string values. The state schema contains only these scalar fields; field order and JSON whitespace do not matter. Extra fields require a protocol version change.

## Aggregate state

The daemon uses Orca's aggregate `agents[].state` and identifies an agent by host, worktree, and `paneKey`. Archived worktrees are excluded.

Priority is `needs_me`, then `just_finished`, then `working`, then `idle`:

- Any `waiting` or `blocked` agent produces `needs_me`.
- An observed transition from another state to `done` produces `just_finished` for four seconds. Several completions extend the same interval.
- Otherwise, any `working` agent produces `working`.
- Otherwise, the creature is `idle`.

The first query establishes a baseline. Existing finished agents do not trigger a celebration. Disappearing agents do not count as completions. After an outage, the next successful query establishes a fresh baseline.

On failure the daemon retains the last behaviour and sets `connected` to false. The simulator marks the source as unavailable. If no valid snapshot arrives for eight seconds, it marks the link as stale. The physical puck reports the same conditions in its serial diagnostics and retains its last expression. Neither case is presented as a confirmed idle session list.

## Tap input

```json
{"version":1,"type":"input","event":"tap"}
```

The simulator and physical puck send a tap when the latest snapshot is connected and no more than eight seconds old, in every expression. Without a live link, touches pet the creature locally. USB writes are bounded so a disconnected Mac does not stall rendering. The daemon accepts only these three input fields, using the same 255-byte line limit. Malformed messages and unsupported versions or events are ignored.

The daemon re-queries Orca before selecting a session. The oldest agent still in `waiting` or `blocked` takes priority. Otherwise it selects the most recently started `working` agent, then the most recently finished `done` agent. Each group is ordered by `stateStartedAt`, with stable identity ordering for ties and missing timestamps after known ones. If no sessions remain, the tap does nothing. Only one focus request can run at a time.

Terminal sessions are matched by execution host, worktree, tab, and leaf, then opened with their current runtime-issued handle. Native chats on this Mac are opened by their session identity. Focus failures are logged to stderr and can be retried with another tap. A tap only changes UI focus.
