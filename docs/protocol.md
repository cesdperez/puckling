# State protocol

The daemon writes one JSON object per line to stdout. `sim/live.py` connects stdout to a raw pseudo-terminal; the simulator opens its slave at 115200 baud. The framing is intended for physical USB serial too. Every poll sends a complete snapshot, so a receiver can join at any time.

```json
{"version":1,"type":"state","state":"working","connected":true}
```

Version 1 has four required fields:

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

On failure the daemon retains the last behaviour and sets `connected` to false. The simulator marks the source as unavailable. If no valid snapshot arrives for eight seconds, it marks the link as stale. Neither case is presented as a confirmed idle session list.
