# Creature

Puckling is one small creature on a round screen. It reacts to touch and lives on the tokens the user's coding tools spend. The goal is a Tamagotchi-style companion that also shows what the Orca sessions on this Mac are doing.

## Food

The feeder on the Mac reads token usage from three places and turns it into food. It reads counts, ids and timestamps only; transcript text never leaves the Mac.

| Tool | Source |
|---|---|
| Claude Code | `~/.claude/projects/**/*.jsonl`, assistant lines with a `message.usage` |
| Codex | `~/.codex/sessions/**/*.jsonl`, token records and legacy token counts |
| opencode | `~/.local/share/opencode/opencode.db`, completed `session_message` rows |

opencode rows from the `claude-agent` provider are skipped, because those runs also appear under `~/.claude/projects`.

Raw counts are dominated by cache reads, which are cheap, so each meal is weighted roughly by cost:

```
weighted = output * 5 + input * 1 + cache_write * 1.25 + cache_read * 0.1
kcal = weighted * model_factor / 1000
```

`model_factor` makes a strong model richer food than a cheap one; the table is in `scripts/feeder/weigh.ts`. Dedupe is by message id, plus a byte offset per file and a watermark for the opencode database. Feeder state is `~/.local/state/puckling/feeder.json`.

The feeder sends one cumulative line, and the creature polls it every 2 seconds:

```
1 total claude codex opencode night parallel tzMinutes generation
```

All values except `tzMinutes` and `generation` are kcal since the feeder state began.

- `night` is the kcal eaten between 22:00 and 07:00 local time.
- `parallel` is the kcal eaten while three or more sessions were active in the last 10 minutes. Subagents count as their own session.
- `tzMinutes` is the feeder's UTC offset at send time, so sleep lands on the user's clock.
- `generation` changes when the feeder state is reset. The creature then takes the line as a new baseline instead of a jump backwards.

The creature turns the counters into shares of the diet over the teen stage.

## Life cycle

Stages: egg, baby, child, teen, adult, final.

- The egg hatches at `HATCH_KCAL`, half a step. Each later stage costs one `STAGE_KCAL`, and at most one evolution happens per poll.
- The adult branch is picked from the diet eaten during the teen stage. A night share of 35 percent or more gives night, a parallel share of 50 percent or more gives swarm, otherwise the tool that ate the most: Claude gives ember, Codex frost, opencode moss. Final keeps the branch.
- Fullness starts empty, drains over 16 hours, and a meal refills an eighth of a step. At zero the creature droops and moves slower, and loses a tenth of a step a day. It never drops below its current stage and never dies.
- At night it sleeps. That needs the clock the feeder sets over USB.

One step is about two days of the user's food. Measured over a week of real use: about 570 million weighted tokens (Claude about 552M, opencode about 14M, Codex about 4M), about 81,000 kcal a day. That sets `STAGE_KCAL = 160000`. Rerun `npm run feed:report` and retune when the pace changes a lot, or the creature stalls in one form or races through them.

## Forms and moments

- Every form is a list of coloured rectangles. `src/pet/shape.ts` owns the geometry for all of them, `src/render.ts` paints them.
- The egg is cream, and cracks at half and at 80 percent of the way to hatching. It wobbles instead of walking.
- Baby, child and teen grow taller and gain limbs. Adult ember has ears and a tail, frost is tall and blue with an antenna, moss is wide and green with a sprout, night is violet with wings and highlighted eyes, swarm is pink with three heads. Final is the adult form plus a gold crown, larger.
- Eating: a yellow pellet drops, the creature walks over, chomps it, then hops.
- Evolving: a three second squash, the body morphs halfway, and sparkles fade out.
- Sleeping: eyes shut, slow breathing, dimmed to 20 percent, with z's rising. It sleeps at night after 30 seconds without a tap, and a tap wakes it for another 30.

It never leaves the inscribed circle of the round panel, and the drawing fades to 30 percent after 60 seconds without a tap. `src/render.ts` scales the colours because the DOM sim ignores `Display.setBrightness`. This rests the AMOLED, which burns in under static light.

The behaviour is deterministic from a seed, so `bun test src/pet` can replay it and assert it, and the same code runs in the sim and on the device.

## Calm rules

The puck sits next to the user all day. It must never nag.

- One sound per event, never repeated. No escalation if it goes unanswered. No looping alarm.
- Sounds are short and soft. A chirp, not a beep. One global volume, low by default.
- Batch events. Several sessions finishing within a few seconds give one sound, not several.
- Quiet hours. At night it sleeps and makes no sound. Events only change the picture.
- Visual over audio. The lasting signal is on screen: the creature looks at the user, or leaves a mess on the floor. Sound only says something changed.
- Unhappy states stay mild. Hunger, boredom and sickness show as a slower, droopier creature. It never flashes, shakes or calls for attention.

## Future

Not built yet.

- Orca session moods, driven by the state of the Orca sessions on this Mac:

  | Sessions | Creature | Sound |
  |---|---|---|
  | None running | Idle, looks around, gets bored | none |
  | Some working | Busy: bobs, reads | none |
  | One goes done | Eats, happy for a moment | soft chirp |
  | One goes waiting or blocked | Turns to face the user and stays that way | soft nudge, once |
  | One stuck working for long | Looks a little worried | none |

- Poop is unread work: one per finished session the user has not looked at, cleaned by tapping, which switches to that session on the Mac. Too much makes it mildly sick.
- Energy is the rate limit: it gets sleepy as the Claude limit fills and wakes when it resets.
- Mute by turning the puck face down, unmute by picking it up. That needs the IMU, as does any other tilt input.
- Wi-Fi or BLE transport instead of the USB cable, so the feeder need not be plugged in.
- Sound, once there is an event worth one, under the calm rules.
- More screens. A round 466x466 display holds one thought: stats, one baby per live agent, usage limits, settings. A bezel wheel drag would turn between them, and the creature stays visible on each so its state is never hidden. Menus on long press act on the selected agent.
