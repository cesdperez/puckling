# puckling

A Tamagotchi-style creature for agentic coding, on a Waveshare ESP32-S3-Touch-AMOLED-1.75C.

The creature lives on a puck next to my keyboard. It feeds on the tokens my Claude Code sessions use, and it shows what my Orca sessions are doing through how it behaves. When a session finishes or needs me, it gives one soft nudge.

## Parts

- **Firmware** (`firmware/`): runs on the puck. Draws screens, plays sounds, reads touch and the IMU, and talks to the Mac. It holds no business logic.
- **Daemon** (`daemon/`): runs on the Mac. Reads token usage and Orca state, owns the creature's state, and pushes frames of state to the puck.
- **Simulator** (`sim/`): runs the firmware's pet and world code in a window on the Mac. `brew install raylib`, then `make -C sim run`. Controls are listed in the window.

## Roadmap

| # | Adds |
|---|---|
| 0 | **MVP.** One creature, a hunger arc, one aggregate session state, soft sounds, tap to jump to the agent that needs me. See [docs/mvp.md](docs/mvp.md). |
| 1 | Poop for unread finished sessions, tap to clean. Face-down mute. |
| 2 | Growth stages and evolution from replayed history. |
| 3 | More than one screen: navigation, babies per agent, speech bubble with the tool. |
| 4 | Approve or deny a waiting prompt from the puck. |
| 5 | Energy from rate limits, gifts from overnight automations, decision gates. |

Details for each step are in [docs/creature.md](docs/creature.md) and [docs/orca.md](docs/orca.md).

## Docs

- [docs/architecture.md](docs/architecture.md): how the puck and the daemon fit together, and open decisions.
- [docs/hardware.md](docs/hardware.md): the board, its pins, and board-specific traps.
- [docs/prior-art.md](docs/prior-art.md): other projects for this board and what to take from each.
- [docs/creature.md](docs/creature.md): the creature: food, behaviour, calm rules, growth, navigation.
- [docs/orca.md](docs/orca.md): what Orca exposes and how it maps to the creature.
- [docs/mvp.md](docs/mvp.md): the first build and when it is done.

## Restoring Watt

This firmware replaces Watt on the puck. To go back, flash Watt from https://watt.sourabhdaroji.com/ in Chrome or Edge.
