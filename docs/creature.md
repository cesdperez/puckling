# Creature

Puckling is one small orange creature on a round screen. Today it is a toy that reacts to touch. The goal is a Tamagotchi-style companion that eats the tokens Claude Code spends, shows what the Orca sessions on this Mac are doing, and grows over days and weeks.

## Now

- Drawn procedurally from rectangles on a single canvas by `src/render.ts`. `src/pet/pet.ts` owns its geometry and behaviour. No sprites, no assets.
- Idle: blinks every few seconds, looks left and right, drifts a little, squashes and stretches gently.
- Tap the body: it flinches, then hops, then calms.
- Tap elsewhere on screen: it walks to that point, turns to face the way it goes, then looks around.
- It never leaves the inscribed circle of the round panel.
- After 60 seconds without a tap the drawing fades to 30 percent brightness while the pet keeps wandering. A tap restores brightness. `src/render.ts` scales the drawing colours because the DOM sim ignores `Display.setBrightness`. This rests the AMOLED, which burns in under static light.
- Silent. No sound, no network, no state outside the device.

The behaviour is deterministic from a seed, so `bun test src/pet` can replay it and assert it, and the same code runs in the sim and on the device.

## Calm rules

The puck sits next to the user all day. It must never nag.

- One sound per event, never repeated. No escalation if it goes unanswered. No looping alarm.
- Sounds are short and soft. A chirp, not a beep. One global volume, low by default.
- Batch events. Several sessions finishing within a few seconds give one sound, not several.
- Quiet hours. At night it sleeps and makes no sound. Events only change the picture.
- Visual over audio. The lasting signal is on screen: the creature looks at the user, or leaves a mess on the floor. Sound only says something changed.
- Unhappy states stay mild. Hunger, boredom and sickness show as a slower, droopier creature. It never flashes, shakes or calls for attention.
- Mute by turning the puck face down, unmute by picking it up. Needs the IMU and is not implemented.

## Future: food from tokens

Claude Code writes one JSONL file per session under `~/.claude/projects/<project>/<session>.jsonl`, and each assistant line carries token usage. Tailing those files gives the creature its food, with a byte offset per file so a restart does not double count, and deduplication by message id because one response can appear on several lines. Codex sessions under `~/.codex/sessions/` can come later.

Raw counts are dominated by cache reads, which are cheap. Weight them roughly by cost so the creature grows from work, not from long contexts:

```
calories = output * 5 + input * 1 + cache_creation * 1.25 + cache_read * 0.1
```

A model factor makes Opus richer food than Haiku. Tune the constants by replaying a week of real transcripts.

## Future: behaviour from sessions

Orca session state drives what the creature does.

| Sessions | Creature | Sound |
|---|---|---|
| None running | Idle, looks around, gets bored | none |
| Some working | Busy: bobs, reads | none |
| One goes done | Eats, happy for a moment | soft chirp |
| One goes waiting or blocked | Turns to face the user and stays that way | soft nudge, once |
| One stuck working for long | Looks a little worried | none |

## Future: life cycle

- Stats: hunger drains over real time and refills with calories; mood and energy alongside.
- Growth by lifetime calories: egg, baby, child, teen, adult, then a final form.
- Evolution branch picked by diet over the previous stage. Mostly Opus gives a wise form, mostly Haiku or Sonnet a fast small one, many parallel worktrees a many-headed one, night-time feeding a nocturnal one.
- Neglect makes it hungry and sad. It never dies; it sulks and loses progress toward the next evolution.
- Poop is unread work: one per finished session the user has not looked at, cleaned by tapping, which switches to that session on the Mac. Too much makes it mildly sick.
- Energy is the rate limit: it gets sleepy as the Claude limit fills and wakes when it resets.
- Sleep at night on the real-time clock, dimming the screen, which also protects the AMOLED.

## Future: interaction and screens

Beyond tap: face down to mute, pick up to wake, tap a poop to clean it, long press for a menu.

Everything past the creature needs more screens, because a round 466x466 display holds one thought: stats, one baby per live agent, usage limits, settings. A bezel wheel drag turns between them, and the creature stays visible on each so its state is never hidden. Menus on long press act on the selected agent.

Not built: transport to the Mac over USB, Wi-Fi or BLE, sound with the calm rules, growth and evolution, IMU input such as tilt, spin and face-down mute.
