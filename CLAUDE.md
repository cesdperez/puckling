# puckling

A GeaStack app: one orange pet on a round 466x466 canvas, running in the browser sim and on a Waveshare ESP32-S3-Touch-AMOLED-1.75C.

- `src/pet/pet.ts` is the whole creature: pure TypeScript, no GeaStack imports, deterministic from a seed. New behaviour goes there, with a case in `src/pet/pet.test.ts`, so it runs on the device and in `bun test`. `src/render.ts` only draws the pose, `src/App.tsx` only runs the loop and turns pointer events into taps.
- Board and target facts are in `docs/hardware.md`. Read it before touching `.gea/boards.json`, pins or display brightness. The alias `puck` points at GeaStack target `esp32-s3-touch-amoled-1.75c`; the plain `esp32-s3-touch-amoled-1.75` is a different board.
- Do not flash without the user's explicit go-ahead. Flashing replaces the puck's current firmware (Watt), which only Watt's web installer restores.
- Visual proof comes from `npm run sim:screenshot`, which needs the sim already running.
- Creature design, the calm sound rules and the long-term vision are in `docs/creature.md`. Read it before adding behaviour or sound.
- Commands in `package.json` are the list; README explains the ones that are not obvious.
