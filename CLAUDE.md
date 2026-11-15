# puckling

A GeaStack app: one orange pet on a round 466x466 canvas, running in the browser sim and on a Waveshare ESP32-S3-Touch-AMOLED-1.75C.

- `src/pet/pet.ts` is the whole creature: pure TypeScript, no GeaStack imports, deterministic from a seed. New behaviour goes there, with a case in `src/pet/pet.test.ts`, so it runs on the device and in `bun test`. `src/render.ts` only draws the pose, `src/App.tsx` only runs the loop and turns pointer events into taps.
- Board, target and toolchain facts are in `docs/hardware.md`. Read it before touching `.gea/boards.json`, pins or display brightness.
- Flash only when the user asks: it replaces the firmware on the puck.
- Visual proof comes from `npm run sim:screenshot`, which needs the sim already running.
- Creature design, the calm sound rules and the long-term vision are in `docs/creature.md`. Read it before adding behaviour or sound.
