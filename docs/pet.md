# Pet POC

A Tamagotchi-style pet that eats the tokens my agents use. More tokens, more food. It grows and evolves over days and weeks.

This is the first milestone because it touches every layer (token source, daemon, link, firmware, screens) with little scope.

## Token source

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
- Orca also tracks Claude and Codex usage per account. Check whether its CLI exposes it before writing a second parser.

## Food value

Raw token counts are dominated by cache reads, which are cheap. Feeding on raw counts would make the pet grow from long contexts, not from work. Weight tokens by roughly what they cost:

```
calories = output * 5 + input * 1 + cache_creation * 1.25 + cache_read * 0.1
```

Multiply by a model factor so Opus is richer food than Haiku. Tune the constants by replaying a week of real transcripts.

## Life cycle

- **Stats:** hunger (drains over real time, refilled by calories), mood, energy.
- **Growth:** stage set by lifetime calories. Egg, baby, child, teen, adult, then a final form.
- **Evolution branch** picked by diet over the previous stage, for example:
  - mostly Opus: a wise form
  - mostly Haiku or Sonnet: a fast, small form
  - lots of subagents or parallel worktrees: a many-headed form
  - night-time feeding: a nocturnal form
- **Neglect:** no tokens for a long stretch makes it hungry and sad. It never dies; it sulks and loses progress toward the next evolution.
- **Sleep:** sleeps at night (RTC). Dims the screen, which also protects the AMOLED.

## Puck interactions

- Tap: pet it (mood up, little animation).
- Turn: flip between the pet and a stats screen (today's calories, stage, progress bar to the next stage).
- Shake (IMU): wake it up.
- Big feeding moments (a long agent run finishes) get a special eating animation.

## Done when

- The daemon tails real transcripts and computes calories.
- The pet grows through at least three stages from replayed history.
- The puck shows the pet animating, reacts to tap, and shows the stats screen.
- Unplugging and replugging the puck resumes at the right state.

## Art

Start with procedural shapes in LVGL (a blob with eyes that blink and look around, like Round-ESP32's avatar). Sprite sheets later, per stage. Use art I can license for a public repo.
