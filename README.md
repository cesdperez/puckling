# puckling

A desk companion for agentic coding, on a Waveshare ESP32-S3-Touch-AMOLED-1.75C.

The puck shows what my coding agents are doing and lets me act on them without switching windows. A small pet lives on it and grows on the tokens my agents burn.

## Parts

- **Firmware** (`firmware/`): runs on the puck. Draws screens, reads touch and the IMU, and talks to the Mac. It holds no business logic.
- **Daemon** (`daemon/`): runs on the Mac. Reads token usage and Orca state, owns the pet's state, and pushes frames of state to the puck.

## Roadmap

1. **Pet POC.** The pet eats tokens from Claude Code transcripts, grows and evolves. See [docs/pet.md](docs/pet.md).
2. **Orca agent ring.** Agent states on the puck, with tap to focus and approve. See [docs/orca.md](docs/orca.md).
3. **Backlog.** Everything else. See [BACKLOG.md](BACKLOG.md).

## Docs

- [docs/architecture.md](docs/architecture.md): how the puck and the daemon fit together, and open decisions.
- [docs/hardware.md](docs/hardware.md): the board, its pins, and board-specific traps.
- [docs/prior-art.md](docs/prior-art.md): other projects for this board and what to take from each.
- [docs/pet.md](docs/pet.md): pet POC spec.
- [docs/orca.md](docs/orca.md): what Orca exposes and what we build on it.

## Restoring Watt

This firmware replaces Watt on the puck. To go back, flash Watt from https://watt.sourabhdaroji.com/ in Chrome or Edge.
