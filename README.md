# Techno Sequencer — Song Studio

Mobile-first, offline-capable techno song arranger based on Web Audio API. No paid services or audio assets are needed.

## Features

- 8 tracks: Kick, Clap, Closed Hat, Open Hat, Perc, Bass, Lead, FX
- Arrangement timeline: tap empty space to create a clip; tap clips to edit; long-press for duplicate, move, length, delete
- Independent clips: duplication copies notes; editing the copy does not change the original
- Clip length controls: 1, 2, 4, 8, 16 or 32 bars (clips repeat their pattern)
- Drum/FX step editor, 16 steps per bar; pattern lengths 1, 2 or 4 bars
- Bass/Lead piano roll with note pitch and note duration; polyphonic lead, monophonic bass
- Track mixer for volume and mute (no panning)
- Track sound presets and three sound-shaping controls, with Japanese help text
- Song tempo 60–200 BPM, song length 16/32/64/128 bars
- Starter Beat helper, per-song JSON download and JSON import
- Auto-save in browser storage, PWA/offline support
- Existing saved pattern library is copied to the new song library once; old data remains unchanged

### Editing

1. Select **New Song**. Tap an empty lane in the **SONG** tab to add a clip.
2. Tap a clip. For drums, tap a step to turn it on/off; for bass/lead, pick a note length and tap the piano roll.
3. Return to **SONG** to position more clips. Long-press a clip to duplicate independently or change its length.
4. Use **MIXER** to adjust volume/mute and **SOUND** to pick a preset and edit simple sound parameters.
5. Songs auto-save locally. On the home screen, choose **Download JSON** for one song, or **Import JSON** to load a song without overwriting another.

Audio export, automation, effects, stereo panning and bulk downloads are deliberately excluded.

## Storage and portability

The project JSON uses `format: techno-sequencer-song` and `version: 2`. It contains all track settings, clips, notes and timeline data. Import creates a **new** song ID; existing songs are never overwritten. Do not clear browser data before exporting important songs.

## GitHub Pages

Serve the repository root from the `main` branch. All paths are relative and work under `/techno-sequencer/`. The older standalone pattern editor remains at `editor.html` for compatibility.
