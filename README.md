# Techno Sequencer — Song Studio

Mobile-first, offline-capable techno song arranger based on Web Audio API. No paid services or audio assets are needed.

## Features

- 8 tracks: Kick, Clap, Closed Hat, Open Hat, Perc, Bass, Lead, FX
- Arrangement timeline is the only view on Song screen; tap an empty 4-bar slot to create a clip, tap clips to edit, or long-press for duplicate, move, length and delete
- Independent clips: duplication copies notes; editing the copy does not change the original
- Clip length options: 4, 8, 16 or 32 bars (each clip repeats its fixed 4-bar pattern). Older short clips retain their arrangement length to prevent unexpected changes
- All patterns are fixed at 4 bars (64 sixteenth-note steps); no pattern length selection. Legacy 1- and 2-bar patterns are expanded by repeating their original note data
- Bass/Lead piano roll with note pitch and note duration; polyphonic lead, monophonic bass
- Track mixer for volume and mute (no panning)
- Track sound presets and three sound-shaping controls, with Japanese help text
- Song tempo 60–200 BPM, song length 16/32/64/128 bars; Song playback advances through the full arrangement, while Pattern/Mixer/Sound playback loops only the selected 4-bar clip
- Per-song JSON download and JSON import (no Starter Beat button)
- Auto-save in browser storage, PWA/offline support
- Existing saved pattern library is copied to the new song library once; old data remains unchanged

### Editing

1. Select **New Song**. The song arrangement opens directly, without tabs. Tap an empty four-bar slot to add a clip.
2. Tap a clip to enter **PATTERN / MIXER / SOUND** mode. The top-left back arrow returns to the full Song arrangement. For drums, tap steps to toggle; for bass/lead, pick note length and place notes on the piano roll.
3. Return using the **top-left back arrow** to position more clips. Long-press a clip to duplicate independently, move by four bars or change its length.
4. Use **MIXER** to adjust volume/mute and **SOUND** to pick a preset and edit simple sound parameters.
5. Songs auto-save locally. On the home screen, choose **Download JSON** for one song, or **Import JSON** to load a song without overwriting another.

Audio export, automation, effects, stereo panning and bulk downloads are deliberately excluded.

## Storage and portability

The project JSON uses `format: techno-sequencer-song` and `version: 2`. It contains all track settings, clips, notes and timeline data. Import creates a **new** song ID; existing songs are never overwritten. Do not clear browser data before exporting important songs.

## GitHub Pages

Serve the repository root from the `main` branch. All paths are relative and work under `/techno-sequencer/`. The older standalone pattern editor remains at `editor.html` for compatibility.
