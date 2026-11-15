# puckling

A GeaStack app: one pet on a round 466x466 canvas, running in the browser sim and on a Waveshare ESP32-S3-Touch-AMOLED-1.75C.

All of `src/pet/` is pure TypeScript with no GeaStack imports, so it runs on the device and in `bun test`.

- Growth and the food format: `src/pet/life.ts`. Every form's rectangles: `src/pet/shape.ts`. Behaviour and pose: `src/pet/pet.ts`, deterministic from a seed. The glue that reads a food line and saves the life: `src/pet/meals.ts`.
- Each of those modules has a test beside it. Add the case there with the change.
- `src/render.ts` only draws the pose, clearing the dirty rectangle from `poseBounds`. `src/App.tsx` only runs the loop and turns pointer events into taps.
- `scripts/feeder/` is the Mac side, also under `bun test`. It reads token counts, ids and timestamps from the transcripts. It never writes transcript text to its output or sends it anywhere. Only the `/feed` body leaves the Mac: the food line, token totals, and per-model counts with model names. Keep it that way.
- `src/stats/` and `src/ui/` are pure modules with a test beside each. `src/screens.ts` draws the stats pages, and `src/feed.ts` is the Wi-Fi client.
- Board, target, toolchain, NVS and devctl traps are in `docs/hardware.md`. Read it before touching `.gea/boards.json`, pins, display brightness or storage keys.
- Creature design, the growth numbers and the calm rules are in `docs/creature.md`. Read it before adding behaviour.
- Flash only when the user asks: it replaces the firmware on the puck.
- Visual proof comes from `npm run sim:screenshot`, which needs the sim already running, or `npm run gallery` for every form at once.
