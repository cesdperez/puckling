# puckling

Read README.md first, then the doc in `docs/` for the area you touch. The approved Pebble contract and images live in `docs/pebble-design.md` and `docs/design/`.

- The board is the **1.75C**. Take pins from `docs/hardware.md`. Community code for the plain 1.75 has different pins.
- Business logic goes in the daemon. Firmware renders state and reports input.
- Before building on an Orca command, check it with `orca <command> --help` and a real `--json` run. Orca ships daily and the CLI changes.
- Copy code only from projects whose license allows it. `docs/prior-art.md` lists each license.
- Record architecture decisions and their reasons in `docs/architecture.md`. Keep supported behavior separate from pending hardware work.

- Keep `ui.cpp`, sprite data and protocol handling shared by simulator and firmware. Reproduce sprite assets with `python3 tools/build_sprites.py`.
- `make validate-sim` uses synthetic Orca only. Put screenshots/logs in ignored `sim/build/validation/`; record validation boundaries in `docs/validation.md`.
- `make firmware` compiles without uploading. Physical display, touch and sensor behavior require separate device checks.
