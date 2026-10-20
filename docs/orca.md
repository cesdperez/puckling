# Orca integration

[Orca](https://onorca.dev) ([source](https://github.com/stablyai/orca), MIT) runs coding agents in parallel git worktrees. It ships a CLI at `/Applications/Orca.app/Contents/Resources/bin/orca` that talks to the running app. Every command takes `--json`.

## What the CLI gives us

Checked against Orca 1.4.232.

| Need | Command | Notes |
|---|---|---|
| Is Orca up | `orca status --json` | `result.runtime.state == "ready"` |
| All worktrees and their agents | `orca worktree ps --json` | Per worktree: `status`, `unread`, `displayName`, `repo`, `branch`, `agents[]`. Per agent: `state`, `agentType`, `prompt`, `lastAssistantMessage`, `toolName`, `toolInput`, `stateStartedAt`, `subagents[]`. |
| Live terminals | `orca terminal list --json` | `handle`, `title`, `agentIdentity`, `preview`, `lastOutputAt` |
| Read a terminal | `orca terminal read` | bounded output |
| Answer an agent | `orca terminal send` | input to a live terminal, e.g. approve a prompt |
| Bring it to the front | `orca terminal switch` | focus a terminal tab on the Mac |
| Start work | `orca worktree create`, `orca agent launch` | new worktree with an agent |
| Wait for idle | `orca terminal wait --for tui-idle` | blocking, per terminal |

Agent states are `working`, `blocked`, `waiting`, `done` (see `src/shared/workspace-session-sleeping-agents.ts` in the Orca repo). `orca agent-context` prints the full machine-readable command schema.

The CLI has no push or subscribe command, so the daemon polls `worktree ps` every few seconds and diffs. Orca also has hooks and a mobile relay (`cloud/` in its repo), which might allow push later.

## Features, in order

1. **Agent ring.** One dot per live agent round the edge, colored by state. The center shows the count waiting on me.
2. **Attention alert.** When an agent enters `waiting` or `blocked`, the puck glows or wakes, with the worktree name and the tool it wants to run.
3. **Focus.** Turn to pick an agent, tap to `orca terminal switch` to it on the Mac.
4. **Approve or deny** from the puck by sending the answer key with `orca terminal send`. Needs care: confirm what the prompt is asking from `terminal read` before sending anything.
5. **Pet tie-in.** The pet reacts to agent states: watches while agents work, waves when one needs me, celebrates when one finishes.

## Open questions

- How `blocked` differs from `waiting` in practice. Watch real sessions.
- Whether Orca hooks can call a local URL, which would replace polling.
- Whether Orca exposes per-account token usage through the CLI (would feed the pet).
