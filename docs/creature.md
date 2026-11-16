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

The creature re-reads food every 2 seconds. It uses the Bluetooth body, or the sim feed file, or the `food` key written over USB. The body starts with the food line, then the token totals:

```
1 total claude codex opencode night parallel tzMinutes generation
1 <generation> <total> <input> <output> <cacheRead> <cacheWrite> <today>
<model> <tokens>
```

All food values except `tzMinutes` and `generation` are kcal since the feeder state began.

- `night` is the kcal eaten between 22:00 and 07:00 local time.
- `parallel` is the kcal eaten while three or more sessions were active in the last 10 minutes. Subagents count as their own session.
- `tzMinutes` is the feeder's UTC offset at send time, so sleep lands on the user's clock.
- `generation` changes when the feeder state is reset. The creature then takes the line as a new baseline instead of a jump backwards.

Line 2 repeats the generation, then raw tokens since the feeder state began: total, input, output, cache read, cache write, and today's total on the local day. Then one `<model> <tokens>` line for every model with tokens, sorted by size, at most 24, and never an `other` line. The puck groups everything past the five largest into `other` on the tokens page, which keeps each model's evolution snapshot stable. Model names are lower-cased, with a leading `claude-` and any 8-digit date suffix stripped, so `claude-haiku-4-5-20251001` reads `haiku-4-5`.

The creature turns the counters into shares of the diet over the teen stage. The token totals drive the stats pages only; growth still follows the weighted kcal.

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

## Screens and names

Swipe left or right to move between four pages. A dot row under the centre marks the current one.

- 0 home: the creature, with a dim `LV n` and the evo name across the bottom.
- 1 evo: `LV n` in large type, the stage and branch as `Adult - Ember`, the evo name, and a progress ring around the bezel, with `NN% to next` or `Max level` at the final form, and `+N tokens since evo`.
- 2 tokens: titled `Tokens`, with the all-time total, then a row per model with its total, the gain since evo and a share bar. It shows the five largest models plus `other`.
- 3 system: titled `System`, with today, input and output, cache read and write, battery and the age of the last Bluetooth link.

With no food yet, the stats pages say `Waiting for food`.

The stats pages return to home after 20 seconds without a touch, so static text does not burn into the AMOLED. A tap reaches the creature on home only.

Level is the stage index: egg 0 through final 5. Each evolution picks a random docker-style `<adjective>_<nerd>` name, and both the name and a per-model token snapshot are stored under the NVS key `evo`. "since evo" is the current count minus the snapshot. A feeder generation reset re-snapshots and keeps the name.

Battery is a thin arc at the top of the bezel. It shows on every stats page, and on home only at 20 percent or below or while charging.

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
- Sound, once there is an event worth one, under the calm rules.
- More screens: one baby per live agent, usage limits, settings, and the creature visible on every page. A bezel wheel drag would turn between them. Menus on long press act on the selected agent.
