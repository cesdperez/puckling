# Pebble

Pebble is the compact round orca calf selected in the [approved character sheet](design/pebble-character.png). It accompanies sessions; it has no care, diet or progression loop.

## Appearance and provenance

Keep a bean-shaped body, blunt snout, stubby dorsal, little paddle flippers, forked tail, ivory chin and belly, white oval patches, small dark actual eyes, and a crooked smile. The palette is charcoal, navy, slate and warm ivory. Status color belongs to icons and words, not changing character markings.

`tools/build_sprites.py` contains original polygon artwork authored for this repository under its MIT license, using the approved sheet as a visual reference. It copies no reference pixels or third-party sprites. Run it with Python 3 to reproduce the five indexed PNGs under `firmware/assets/` and the static pixel rows in `firmware/src/sprites.h`. The firmware reads those rows at integer scale, without interpolation. The reference images remain intact in `docs/design/`.

## Expressions

| State | Pebble | Explicit UI |
|---|---|---|
| Idle / all clear | Gentle hovering, blinking, occasional tail movement | All clear, working/monitoring counts, Browse sessions |
| Working | Head down toward a small work tile, focused eyes, engaged paddles | Work icon and Working, muted blue-gray |
| Monitoring | Calm idle pose | Bars and Monitoring, muted blue-gray |
| Needs input / attention | Faces the user with a politely raised paddle | Bubble and words, amber |
| Successful finish | Restrained happy pose briefly, then calm | Check and Finished, mint |
| Failure | Mild concern, persistent | Exclamation and Failed, coral |
| Unknown / lost link | Calm pose | Status unknown / Connection lost, freshness text, disabled action |

## Calm notifications and AMOLED

Requests persist visually. The daemon advances a cue counter for new attention events, with a three-second batching interval. Firmware gives a brief visual dot for a changed counter; acknowledged unresolved requests do not repeat their cue. New completions require an observed transition, not a worktree unread flag. No screen is forcibly changed.

Sound is not implemented. The intended hardware policy is one short soft cue per batch, respecting mute, with no alarm loop or escalation. Mute, quiet hours, lift-to-wake and face-down sensing are pending. Failure has no repeated alarm animation.

Pebble moves subtly on the logical grid. The firmware dims the panel after 60 seconds without touch and restores brightness on touch. Brightness, burn-in mitigation over long use and sensor timing require physical validation. No hardware validation is claimed by simulator screenshots.
