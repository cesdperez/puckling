# Puckling

A small creature that lives on the round screen of a [Waveshare ESP32-S3-Touch-AMOLED-1.75C](docs/hardware.md).

It is drawn procedurally from coloured rectangles on one 466x466 canvas, no sprites. It idles, looks around, wanders, blinks, squashes and stretches, and stays inside the inscribed circle of the round panel. Tap it and it flinches, then hops. Tap somewhere else and it walks there.

It eats the tokens Claude Code, Codex and opencode spend. Food fills it up and grows it through egg, baby, child, teen, adult and a final form. At night it sleeps. The growth rules are in [creature behaviour](docs/creature.md).

The app is built with [GeaStack](https://geastack.com). The same TypeScript runs in the browser sim, on the device through GeaStack's C++ compiler, and in `bun test`.

## Run

```sh
npm install
npm run sim          # browser sim, mouse acts as touch
npm test             # bun test src scripts/feeder
npm run check        # tsc --noEmit
```

The emulator shell is at http://127.0.0.1:5181/__gea_emulator.

`npm run sim:screenshot [file.png]` captures the running sim with Playwright (default `./sim.png`). The first run needs `npx playwright install chromium`.

## Feed it

The feeder runs on Bun. It reads token usage from the Claude Code, Codex and opencode transcripts on this Mac and feeds the puck, over Wi-Fi or USB.

```sh
npm run feed                 # one update over USB
npm run feed -- --watch 60   # update every minute, survive an unplugged puck
npm run feed -- --sim        # write feed/food.txt for a running sim instead
npm run feed -- --dry-run    # print the line and send nothing
npm run feed -- --backfill 7 # first run only: also eat the last 7 days
npm run feed:report          # weighted tokens per tool over the last 7 days
```

Over Wi-Fi the feeder also serves `GET /feed` on port 7878, and the puck polls it every 5 seconds:

```sh
printf 'GEA_WIFI_SSID=my-network\nGEA_WIFI_PASSWORD=secret\n' > .env  # gitignored
npm run build:firmware       # GeaStack compiles the credentials into the firmware
npm run flash                # then reboot with the puck unplugged
npm run feed:serve           # feeder every 5 s, plus GET /feed on port 7878
npm run feed:pair            # once, with the puck on USB: stores the feed URL
```

`feed:serve` sends nothing over USB. `--sim` still writes `feed/food.txt`. The body carries counts and model names only, never transcript text. `feed:pair` stores the Mac's LAN address on the puck, so run it again when the address changes. Until then the puck reads `http://127.0.0.1:7878/feed`, which is what the browser sim needs.

A new feeder starts from now, so it sees an egg. For history, the first run takes `npm run feed:serve -- --backfill 42` to eat the last 42 days. `--port <dev>` or `PUCKLING_PORT` picks the puck when it is not the configured serial. A running sim reads `feed/food.txt` through the `gea.webPreload` entry in `package.json`. Feeder state lives in `~/.local/state/puckling/feeder.json`.

Swipe left or right to move between four pages: the pet, level and evolution, tokens per model, and system status. The stats pages return to the pet after 20 seconds without a touch.

`npm run gallery [file.png]` renders every form, plus eating, sleeping and evolving, to a PNG (default `./forms.png`).

## Device

```sh
npm run build:firmware
npm run flash        # see firmware warning in docs/hardware.md
npm run monitor
npm run screenshot   # device screen to a PNG
```

`npx gea doctor` checks the toolchain, and `npx gea devctl help` lists device control. See [docs/hardware.md](docs/hardware.md) for board and toolchain requirements. The optional wasm sim renderer (`--renderer wasm`) needs emsdk.

Food over USB, eating, hatching, and growth across reboots are checked on the puck. The Wi-Fi feed, the screens and the battery arc are not yet checked there, nor are touch, brightness and frame rate.

### Reset growth

```sh
npx gea devctl storage set life 0
```

The stored value does not parse as a life, so the app starts a fresh egg. The running app replaces the value on its next save, which is a meal, an evolution, or ten minutes, so reboot the puck straight after.

## Layout

`src/pet/` holds the growth rules and the behaviour as pure TypeScript, `src/render.ts` draws the pose, `src/App.tsx` runs the loop, and `scripts/feeder/` is the Mac side. See [CLAUDE.md](CLAUDE.md) for where changes go.

## License

Repo source is MIT, see [LICENSE](LICENSE). Firmware binaries built with GeaStack's embedded targets are GPL-3.0-only, because those targets carry that license. The GeaStack framework and compiler are Apache-2.0.
