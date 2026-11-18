# Pocket Rack

A pocket-sized music rack that runs entirely in the browser (Web Audio API) and is designed for phones. Single HTML file, no build step, no dependencies.

## Devices

- **DRM-8 rhythm unit**: 8 synthesized drum voices (kick, snare, clap, closed/open hat, tom, rim, bell), 16-step sequencer, per-voice level/tune/decay, swing.
- **VX-1 mono synth**: 2 oscillators + sub + noise, resonant lowpass filter with envelope, ADSR amp, LFO (pitch/filter/amp), 16-step sequencer with accent and slide, live keyboard.
- **WG-1 wave gen + XY pad**: Kaoss-style touch pad. Synth programs (Lead, Theremin, Wobble) and FX programs (DJ Filter, Delay, Roll) that process whatever is patched into its FX input.
- **PL-1 track deck**: load an audio file you own, with waveform seek, 3-band EQ with kills, turntable-style speed, loop, BPM detection / tap tempo, and sync to the rack transport. Live **stems** (vocals / drums / bass / melody) via real-time spectral separation, plus a bitrate/quality readout.
- **MX-4 mixer**: 4 channels with level, pan, delay send and mute, a tempo-synced send delay, master drive and volume.

## Flip the rack

Tap **FLIP** to see the back panel and patch cables: tap an output, then an input. Audio and CV/gate jacks are available (LFO, envelope, gate, note CV, pad X/Y, drum triggers), each CV input has a bipolar trim. The default patch includes a kick-triggered sidechain duck on the bass channel.

## Install on your phone

Open the GitHub Pages URL, then **Share → Add to Home Screen** (iOS Safari) or **⋮ → Add to Home screen / Install app** (Android Chrome). It runs full-screen and works offline after the first load.

Patterns, settings and cables are saved in the browser's local storage. Loaded tracks are not stored.
