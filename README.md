# Techno Sequencer

Mobile-first techno step sequencer built with vanilla HTML/CSS/JavaScript and the Web Audio API.

## Flow

1. Home screen: choose a saved pattern or create a new blank pattern.
2. Editor: build the pattern with the 8-track step sequencer.
3. Save: new patterns ask for a name; existing patterns are overwritten.
4. After saving, the app returns to the home screen.

Saved patterns remain browser-local using LocalStorage. Existing pattern-library data from earlier versions is preserved.

## Features

- 8 tracks: Kick, Clap, Closed Hat, Open Hat, Perc, Bass, Lead, FX
- 1/8 and 1/16 resolution
- 16 or 32 steps
- 80–180 BPM
- Per-track mute and clear
- Bass pitch selection by holding an active bass step
- Multiple named patterns
- Scroll-safe step tapping
- Portrait-first mobile UI
- PWA / offline cache
- No external audio files or JavaScript libraries

## GitHub Pages

Publish the repository root from `main`. The app uses relative paths and works under `/techno-sequencer/`.
