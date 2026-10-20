# puckling

Read README.md first, then the doc in `docs/` for the area you touch.

- The board is the **1.75C**. Take pins from `docs/hardware.md`. Community code for the plain 1.75 has different pins.
- Business logic goes in the daemon. Firmware renders state and reports input.
- Before building on an Orca command, check it with `orca <command> --help` and a real `--json` run. Orca ships daily and the CLI changes.
- Copy code only from projects whose license allows it. `docs/prior-art.md` lists each license.
- When a decision in `docs/architecture.md` gets made, move it out of "Open decisions" and record the reason.
