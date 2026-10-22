# Orca integration

Pebble polls `orca worktree ps --limit 10000 --json` every two seconds. It requires `ok: true`, `truncated: false` and an empty `hostScope.omittedHostIds`. Partial coverage is an unavailable source. Archived worktrees are excluded. The query spans the runtime's reported projects and execution hosts, not just the current checkout.

The installed version-matched guide (`orca skills get orca-cli`), command help and read-only real JSON calls were checked during implementation. The installed status projector explicitly maps permission/question blocks to `waiting`, and authentication/unnamed blocks to `blocked`. These are not interchangeable with approval. No live approval or question was induced for testing.

## Metadata and labels

| Orca metadata | Use |
|---|---|
| `hostId`, `worktreeId`, agent `paneKey` | Exact identity, serialized as a JSON tuple to avoid delimiter collisions |
| `repo` / repo name, fallback `displayName` | Project label |
| agent `displayName` | Existing session title, otherwise Session plus short identity digest |
| `agentType` | Claude, Codex or other reported agent type |
| `state`, `stateStartedAt` | State and deterministic ordering |
| `workingMode: monitoring` | Monitoring, distinct from productive Working |
| `mainAgent.outcome` | Failure, success, cancellation, superseded, interruption or unconfirmed result |
| worktree `unread` | Deliberately unused for per-session alerts |

Titles are bounded printable ASCII for the small font, with ellipses when shortened. Labels include a stable short identity digest, so siblings with identical titles stay distinguishable. Device tokens are opaque SHA-256 digests scoped to one daemon lifetime. Raw paths and pane keys stay on the Mac. No LLM is called to name sessions. Prompts, tool arguments, assistant messages, previews and terminal transcripts are neither retained in the session model nor forwarded/logged.

## States

- `waiting`: **Needs input**, with the generic reason Waiting for your input.
- `blocked`: **Needs attention**, with a generic reason. It is never automatically labeled Approval.
- `working` with monitoring mode: **Monitoring**; otherwise **Working**.
- `done` + failure: **Failed** and an actionable persistent alert, even though lifecycle state says done.
- `done` + success: **Finished**, with a mint check.
- `done` + cancellation/superseded: **Ended**, without a success celebration.
- `done` + interruption/unconfirmed: **Needs attention**, without claiming provider failure or success.
- `done` without an outcome: **Finished / Outcome not reported**, in muted color without a success pose. An observed new result can enter Attention, but success is never inferred.

## Recency and ordering

Sessions includes every non-done session, every unresolved attention event, every unacknowledged observed result, and done sessions whose `stateStartedAt` is within the last **24 hours**. Inactive results with missing timestamps are excluded unless observed during this daemon run. Active sessions stay included regardless of age.

Ordering is deterministic:

1. Unseen actionable requests and failures.
2. Seen unresolved actionable requests and failures.
3. Unacknowledged observed completed results.
4. Other active working/monitoring sessions.
5. Recent inactive results.

The first three groups use oldest state timestamp first. The last two use newest first. Missing timestamps follow known timestamps within a group. Full identity breaks ties. Attention is the first three groups. Positions and totals refer to the complete list, even when only a bounded window is on the wire.

## Events and acknowledgement

The first successful poll establishes a completion baseline. Historical done sessions and newly discovered done rows do not create completion alerts. After an outage, the first complete poll also establishes a baseline. Disappearance does not mean completion. A known row changing into a new done success/unknown-outcome result creates an event. Waiting, blocked, failure and unconfirmed/interrupted ends create actionable events. Event identity uses session identity, state, state-start timestamp and outcome.

Opening is acknowledged **only after a confirmed focus receipt**. It means the user saw the displayed event. It does not answer a question, grant approval, or fix a failed run. Unresolved actionable events remain in Attention with Seen / still needs you, below unseen requests. Acknowledged completed results leave Attention and remain in Sessions according to recency. A tap on an older event cannot acknowledge a newer event received during focus.

Home preserves its selected card until intentional navigation. After Opened, its Next request action deliberately selects an unseen request when one remains. Incoming alerts do not replace the card under a finger. A resolved/removed selection becomes unavailable; arrows or a vertical swipe intentionally choose another. Selections are pinned by the daemon across bounded windows. Acknowledgement is in memory, not durable storage. Restart baselines old completions and treats still-actionable requests as unseen.

## Focus

The device sends the displayed token, offered snapshot sequence and request number. The daemon requires fresh source metadata and a token actually offered in that recent frame, suppresses duplicate/concurrent focus, queries Orca again, and resolves the exact original identity. A missing identity cannot fall back to another session.

Terminals must uniquely match execution host, workspace, tab and leaf, be connected and non-orphaned, and have a current runtime-issued handle from `terminal list`. Only then does `terminal switch --terminal <handle>` run. Its receipt must report `focus.navigated: true`. No create or send command is used.

Local native chats use the existing installed macOS runtime adapter, `agentSession.reveal`, with the session ID from the structured tab portion of `paneKey`. It verifies the returned identity and successful reveal before activating Orca. Remote native chats are explicitly unsupported. Adapter/API failure yields a retry state. This bundled adapter can need maintenance when Orca changes.

The read-only smoke check exercised `worktree ps` and `terminal list`. All navigation validation used synthetic CLI replies and a synthetic bundled native runtime. No real session was switched by the validation suite. See [validation](validation.md).
