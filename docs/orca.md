# Orca integration

[Orca](https://onorca.dev) ([source](https://github.com/stablyai/orca), MIT) runs coding agents in parallel git worktrees. It ships a CLI at `/Applications/Orca.app/Contents/Resources/bin/orca` that talks to the running app. Every command takes `--json`.

## What the CLI gives us

Checked against Orca 1.4.232.

| Need | Command | Notes |
|---|---|---|
| Is Orca up | `orca status --json` | `result.runtime.state == "ready"` |
| All worktrees and their agents | `orca worktree ps --json` | Per worktree: `status`, `unread`, `displayName`, `repo`, `branch`, `agents[]`. Per agent: `state`, `agentType`, `prompt`, `lastAssistantMessage`, `toolName`, `toolInput`, `stateStartedAt`, `subagents[]`. |
| Rate limits | `orca account list --json` | `result.rateLimits.claude.session` and `.weekly`: `usedPercent`, `resetsAt`. Codex has the same shape. |
| Live terminals | `orca terminal list --json` | `handle`, `title`, `agentIdentity`, `preview`, `lastOutputAt` |
| Read a terminal | `orca terminal read` | bounded output |
| Answer an agent | `orca terminal send` | input to a live terminal, e.g. approve a prompt |
| Bring it to the front | `orca terminal switch` | focus a terminal tab on the Mac |
| Automation runs | `orca automations runs` | history of scheduled runs |
| Decision gates | `orca orchestration gate-list` | pending decisions that block a task |

Agent states are `working`, `blocked`, `waiting`, `done` (see `src/shared/workspace-session-sleeping-agents.ts` in the Orca repo). `orca agent-context` prints the full machine-readable command schema.

The CLI has no push or subscribe command, so the daemon polls `worktree ps` every 2 seconds and diffs. Orca also has hooks and a mobile relay (`cloud/` in its repo), which might allow push later.

## How it maps to the creature

| Orca | Creature | Step |
|---|---|---|
| Agent `state` transitions | Aggregate behaviour and one soft sound (see [creature.md](creature.md)) | MVP |
| Oldest agent in `waiting` or `blocked` | Tap target: `orca terminal switch` | MVP |
| Worktree `unread` after `done` | Poop. Tap to clean, which switches to it. | 1 |
| Agent count and `agentType` | Diet for evolution | 2 |
| `agents[]`, `subagents[]`, `toolName` | Babies, turn to pick, speech bubble | 3 |
| `terminal read` + `terminal send` | Approve or deny from the puck. Confirm what the prompt asks before sending anything. | 4 |
| `rateLimits` | Energy | 5 |
| Automation runs that finished overnight | A gift waiting in the morning | 5 |
| Pending decision gates | Creature holds up a sign | 5 |

## Open questions

- How `blocked` differs from `waiting` in practice. Watch real sessions.
- Whether Orca hooks can call a local URL, which would replace polling.
- Whether `unread` clears when I open the session in Orca, so cleaning a poop needs no extra call.
