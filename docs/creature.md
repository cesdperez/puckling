# Creature

A Tamagotchi-style creature. It eats the tokens my agents use, and its behaviour shows what my Orca sessions are doing. It grows and evolves over days and weeks.

## Calm rules

The puck sits next to me all day. It must never nag.

- **One sound per event, never repeated.** No escalation if I ignore it. No looping alarm.
- **Sounds are short and soft.** A chirp, not a beep. One global volume, low by default.
- **Batch events.** Several sessions finishing within a few seconds give one sound, not several.
- **Quiet hours.** At night it sleeps and makes no sound. Events only change the picture.
- **Mute.** Face down on the desk mutes it (IMU). Picking it up unmutes.
- **Visual over audio.** The lasting signal is on screen (the creature looks at me, a poop on the floor). The sound only says "something changed".
- **Unhappy states stay mild.** Hunger, boredom and sickness show as a slower, droopier creature. It never flashes, shakes or calls for attention.

## Food

Claude Code writes one JSONL file per session under `~/.claude/projects/<project>/<session>.jsonl`. Each assistant line carries usage:

```json
{"type":"assistant","timestamp":"2026-10-20T19:19:52.469Z",
 "message":{"model":"claude-opus-5-5",
  "usage":{"input_tokens":2,"output_tokens":112,
           "cache_creation_input_tokens":18900,"cache_read_input_tokens":23739}}}
```

- Tail every file under that tree. Remember the byte offset per file so restarts do not double count.
- Deduplicate by message id: one response can appear on several lines.
- Codex sessions live under `~/.codex/sessions/`. Add later.

Raw token counts are dominated by cache reads, which are cheap. Feeding on raw counts would make it grow from long contexts, not from work. Weight tokens by roughly what they cost:

```
calories = output * 5 + input * 1 + cache_creation * 1.25 + cache_read * 0.1
```

Multiply by a model factor so Opus is richer food than Haiku. Tune the constants by replaying a week of real transcripts.

## Behaviour from sessions

The daemon reduces all Orca agents to what the creature does. See [orca.md](orca.md) for the source fields.

| Sessions | Creature | Sound |
|---|---|---|
| None running | Idle, looks around, gets bored after a while | none |
| Some `working` | Busy: bobs, types, reads | none |
| One goes `done` | Eats, happy for a moment | soft chirp |
| One goes `waiting` or `blocked` | Turns to face me and stays that way until I act | soft nudge, once |
| One stuck in `working` for long | Looks a little worried | none |

## Life cycle

- **Stats:** hunger (drains over real time, refilled by calories), mood, energy.
- **Growth:** stage set by lifetime calories. Egg, baby, child, teen, adult, then a final form.
- **Evolution branch** picked by diet over the previous stage, for example:
  - mostly Opus: a wise form
  - mostly Haiku or Sonnet: a fast, small form
  - many parallel worktrees: a many-headed form
  - night-time feeding: a nocturnal form
- **Neglect:** no tokens for a long stretch makes it hungry and sad. It never dies. It sulks and loses progress toward the next evolution.
- **Poop is unread work.** Each finished session I have not looked at leaves a poop. Tap to clean it, which switches to that session on the Mac. Too much poop makes it mildly sick.
- **Energy is the rate limit.** It gets sleepy as the Claude session limit fills up, and wakes up when it resets.
- **Sleep:** sleeps at night (RTC). Dims the screen, which also protects the AMOLED.

## Interactions

MVP:

- Tap: if a session needs me, switch to it on the Mac. Otherwise pet it.

Later:

- Face down: mute. Pick up: unmute and wake.
- Tap a poop: clean it (switch to that session).
- Long press: menu.

## Screens and navigation

Not in the MVP. The home screen is the creature. Everything else goes on more screens, because it will not fit on one round 466x466 display.

- **Bezel wheel.** Drag round the ring to turn, like Watt. Turning moves between screens or through a list.
- **Screens to add:** stats (stage, calories today, progress to next stage), agents (one baby per live agent, turn to pick, speech bubble with worktree and tool), limits (Claude and Codex usage and reset time), settings (volume, quiet hours).
- **Menus** on long press, for actions on the selected agent: switch, approve, deny.
- The creature stays on every screen, small, so the state is never hidden.

Decide the navigation model with HTML mockups first (see [architecture.md](architecture.md)).

## Art

Start with procedural shapes in LVGL (a blob with eyes that blink and look around, like Round-ESP32's avatar). Sprite sheets later, per stage. Use art I can license for a public repo.
