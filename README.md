# Techno Sequencer

Mobile-first techno step sequencer built with vanilla HTML/CSS/JavaScript and the Web Audio API.

## Phase 1 features

- 8 tracks: Kick, Clap, Closed Hat, Open Hat, Perc, Bass, Lead, FX
- 1/8 and 1/16 resolution
- 16 or 32 steps
- 80–180 BPM
- Per-track mute and volume
- Per-track clear and full-pattern clear
- Bass pitch selection by holding an active bass step
- Browser-local pattern save
- Mobile-first UI
- PWA manifest + service worker for home-screen use/offline caching
- No external audio files or JavaScript libraries

## Run locally

Serve the folder over HTTP (service workers do not work from `file://`). For example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## GitHub Pages

Publish from the repository root on the `main` branch. The app uses relative paths, so it works under the `/techno-sequencer/` project path.
