# Pebble protocol v2

The Bun daemon writes one complete JSON object per line to stdout and reads device JSON input lines from stdin. USB uses `daemon/serial.py` at 115200 baud. The native simulator uses the same duplex framing over a raw PTY. Firmware diagnostics are plain text on the same port; the bridge prints those separately and the daemon ignores them.

Version 2 replaces the v1 aggregate expression and any-tap selection. Upgrade firmware and daemon together. Unsupported versions are rejected, without v1 fallback.

## Snapshot

```json
{"version":2,"type":"state","seq":1,"connected":true,"age":0,"total":1,"attention":1,"working":0,"monitoring":0,"cue":1,"request":0,"target":"","feedback":"none","selection":["a123456789abcdef","a123456789abcdef","a123456789abcdef"],"sessions":[["a123456789abcdef","goodhabitz","Session 25bf039a","claude",0,true,false,true,"Waiting for your input",1]]}
```

All object fields are required. Order and JSON whitespace do not matter. Unknown/duplicate object fields are rejected. Strings use unescaped printable ASCII. Numbers are nonnegative integers up to 2,147,483,647. Extra data, trailing commas, malformed types and duplicate card identities reject the whole line atomically. The last good display and its original freshness remain intact.

| Field | Meaning |
|---|---|
| `seq` | Positive daemon snapshot sequence; offered identity set for focus validation |
| `connected` | Latest Orca query covered the complete requested host/workspace scope |
| `age` | Milliseconds since the last successful source query, capped at the integer limit, which also represents no successful source query yet |
| `total`, `attention` | Complete active/recent session and attention counts |
| `working`, `monitoring` | Separate counts across all source sessions |
| `cue` | Batched attention event counter, for a brief visual cue |
| `request`, `target`, `feedback` | Last input receipt; zero/empty/none before input |
| `selection` | Three daemon-pinned initial identities for Home, Attention and Sessions; empty strings when unset |
| `sessions` | At most 32 individual card tuples, including pinned selections |

Card tuples are `[token, project, label, agent, state, attention, seen, supported, reason, position]`:

- `token`: exactly 16 lowercase hex digits. It addresses the daemon's exact host/workspace/pane tuple without exposing that tuple. Tokens change on daemon restart.
- `project`: at most 24 characters; `label`: at most 24; `agent`: at most 10; `reason`: at most 32. Text is metadata or a fixed generic explanation, never prompt/transcript text.
- `state`: `0` Needs input, `1` Needs attention, `2` Failed, `3` Finished with success, `4` Working, `5` Monitoring, `6` Ended, `7` Finished with unknown outcome. Unknown outcome is muted and never a success celebration.
- `attention`, `seen`, `supported`: booleans. Seen does not mean resolved. Remote native chat targets are unsupported; terminal availability is rechecked on focus.
- `position`: positive one-based position in the entire ordered Sessions list. Attention is the leading contiguous part of that list, so its positions use the same numbers.

Frames are at most **12,288 bytes excluding newline**, with a fixed receive buffer and at most 32 cards. Overlong lines are discarded through newline. A partial line never changes the display. NUL, non-ASCII, escaped strings, overlong labels, duplicate tokens and a 33rd card are rejected. Parser tests cover recovery after malformed input and clock wraparound. The USB bridge independently bounds queued traffic to 64 KiB per direction.

The daemon holds the full list. Each snapshot carries a bounded window plus the three page selections. The explicit `selection` tuple makes first visits to a page use the same identities the daemon pins. Card stepping is resolved against the full list on the Mac and returns the target in the next window. Source ordering is specified in [orca.md](orca.md). A new alert does not evict a selected identity, even when the list exceeds 32 cards.

## Freshness

The receiver adds elapsed local time to `age`. Source age above **8,000 ms**, `connected: false`, or no valid snapshot disables focus. Action receipts do not refresh source age. The daemon also checks freshness before and after focus discovery, and requires a recently offered identity/sequence. Invalid lines never renew freshness. Status unknown, Connection lost and elapsed freshness are rendered explicitly.

## Input and feedback

```json
{"version":2,"type":"input","event":"open","id":"a123456789abcdef","seq":1,"request":1}
{"version":2,"type":"input","event":"step","id":"a123456789abcdef","seq":1,"request":2,"view":1,"direction":1}
```

Input lines are limited to **255 bytes excluding newline**. Required fields are exact; unknown fields, malformed data, invalid bounds and unsupported versions/events are ignored. `request` is a positive increasing device counter within a live bridge session. The bridge/daemon should be restarted when the device reconnects. `seq` is the displayed snapshot sequence, captured at finger-down for opening. `id` is the displayed token, also captured at finger-down. For an empty/removed selection, step may use an empty token. `view` is Home `0`, Attention `1`, Sessions `2`; direction is `-1` or `1`.

Open requires a fresh frame that offered that token. It revalidates the full identity with Orca and never substitutes another session. Step is read-only local browsing and never navigates Orca. It wraps through the full filtered list. The daemon pins the resulting selection and emits `selected` with its target token. Firmware applies a selection receipt after touch release. If an old selection disappears, the UI holds an unavailable card until intentional next/previous selection.

Feedback values are `none`, `opening`, `opened`, `retry`, `unavailable`, `unsupported`, and `selected`. Receipts echo the device request number and target. `opened` requires actual navigation confirmation; only then is the displayed event acknowledged. `retry` permits another intentional open with a new request number. One focus can run at a time across page changes, and duplicate request numbers do not navigate twice. Receipt labels stay attached to their original card identity. Firmware shows a retry after 20 seconds without a final focus receipt.

The shared gesture recognizer uses a 16 px tap slop, 48 px horizontal and 40 px vertical swipe threshold, and 1.25 axis dominance. Any excursion beyond tap slop cancels opening, even when the finger comes back. Taps release within 700 ms. The white action occupies x=104..362, y=366..418. Previous/next targets are 56 px wide. Touch tracking runs independently from the 15 fps hardware drawing loop. Partial USB input writes are drained as transmit space becomes available.

No prompt input, approvals, denials, microphone data or terminal contents are part of this protocol. Audio is not implemented; cue counters currently drive only a visual dot.
