# Puckling

A small creature that lives on the round screen of a [Waveshare ESP32-S3-Touch-AMOLED-1.75C](docs/hardware.md).

It is a blocky orange pet drawn procedurally on one 466x466 canvas, no sprites. It idles, looks around, wanders, blinks, squashes and stretches, and stays inside the inscribed circle of the round panel. Tap it and it flinches, then hops. Tap somewhere else and it walks there.

The pet keeps wandering as the drawing dims after inactivity. A tap restores brightness. See [creature behaviour](docs/creature.md).

The app is built with [GeaStack](https://geastack.com). The same TypeScript runs in the browser sim, on the device through GeaStack's C++ compiler, and in `bun test`.

## Run

```sh
npm install
npm run sim          # browser sim, mouse acts as touch
npm test             # bun test src/pet
npm run check        # tsc --noEmit
```

The emulator shell is at http://127.0.0.1:5181/__gea_emulator.

`npm run sim:screenshot [file.png]` captures the running sim with Playwright (default `./sim.png`). The first run needs `npx playwright install chromium`.

## Device

```sh
npm run build:firmware
npm run flash        # see firmware warning in docs/hardware.md
npm run monitor
npm run screenshot   # device screen to a PNG
```

`npx gea doctor` checks the toolchain, and `npx gea devctl help` lists device control. See [docs/hardware.md](docs/hardware.md) for board and toolchain requirements. The optional wasm sim renderer (`--renderer wasm`) needs emsdk.

Touch, brightness and frame rate are not yet checked on a physical puck. The firmware builds and the pet runs in the sim.

## Layout

`src/pet/` holds the behaviour as pure TypeScript, `src/render.ts` draws it, and `src/App.tsx` runs the loop. See [CLAUDE.md](CLAUDE.md) for where changes go.

## Roadmap

Food from Claude Code tokens, Orca session moods, sound, growth and IMU input are planned. See [docs/creature.md](docs/creature.md).

## License

Repo source is MIT, see [LICENSE](LICENSE). Firmware binaries built with GeaStack's embedded targets are GPL-3.0-only, because those targets carry that license. The GeaStack framework and compiler are Apache-2.0.
