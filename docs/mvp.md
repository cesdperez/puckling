# MVP

The smallest build that is still the real thing. It touches every layer: token source, Orca, daemon, link, firmware, screen and speaker.

## Scope

1. **Food.** The daemon tails Claude Code transcripts, computes calories (see [creature.md](creature.md)) and keeps one hunger value.
2. **Session state.** The daemon polls `orca worktree ps --json` every 2 seconds and reduces all agents to one state: `idle`, `working`, `needs_me`, `just_finished`.
3. **Screen.** One screen. A procedural blob with four expressions, one per state, and a hunger arc round the edge.
4. **Sound.** A soft chirp when an agent goes `done`. A soft nudge when one goes `waiting` or `blocked`. Each plays once and follows the calm rules.
5. **Tap.** A connected tap opens an Orca terminal or native chat. The oldest waiting agent takes priority, followed by the most recently started working agent, then the latest finished agent. Without a live link, tap pets the creature.
6. **State** lives in one JSON file on the Mac.

## Not in the MVP

Growth stages, evolution, poop, babies, more screens, navigation, menus, approve or deny, mute, quiet hours, rate limits.

## Done when

- Real transcripts change hunger, and hunger shows on the arc.
- Each of the four states shows on the puck within a few seconds of the change in Orca.
- Sounds play once per event, and several events close together give one sound.
- Tap on `needs_me` brings the right terminal to the front on the Mac.
- Tap while working or after completion opens a session without waiting for `needs_me`.
- Unplugging and replugging the puck resumes at the right state.
- It runs in the simulator (`sim/`) first, then on the puck.
