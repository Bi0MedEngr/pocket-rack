# Pocket Rack

A pocket-sized music rack that runs entirely in the browser (Web Audio API) and is designed for phones. Single HTML file, no build step, no dependencies.

## Devices

- **DRM-8 rhythm unit**: 8 synthesized drum voices (kick, snare, clap, closed/open hat, tom, rim, bell), 16-step sequencer, per-voice level/tune/decay, swing.
- **VX-1 mono synth**: 2 oscillators + sub + noise, resonant lowpass filter with envelope, ADSR amp, LFO (pitch/filter/amp), 16-step sequencer with accent and slide, live keyboard.
- **WG-1 wave gen + XY pad**: Kaoss-style touch pad. Synth programs (Lead, Theremin, Wobble) and FX programs (DJ Filter, Delay, Roll, Reverb, Flanger, Crush, Gate, Ring Mod, Brake) that process whatever is patched into its FX input.
- **PL-1 track deck**: load an audio file you own, with waveform seek, 3-band EQ with kills, turntable-style speed, loop, BPM detection / tap tempo, and sync to the rack transport. Live **stems** (vocals / drums / bass / melody) via real-time spectral separation, plus a bitrate/quality readout. **AI STEMS (beta)** runs Meta's HTDemucs model in your browser while the track plays: the live splitter works instantly, and as each ~6-second chunk is separated the deck crossfades to the AI stems (green strip on the waveform shows what's ready, the stem row glows while AI is active).
- **MX-4 mixer**: 4 channels with level, pan, delay send and mute, a tempo-synced send delay, master drive and volume.

## Flip the rack

Tap **FLIP** to see the back panel and patch cables: tap an output, then an input. Audio and CV/gate jacks are available (LFO, envelope, gate, note CV, pad X/Y, drum triggers), each CV input has a bipolar trim. The default patch includes a kick-triggered sidechain duck on the bass channel.

## Install on your phone

Open the GitHub Pages URL, then **Share → Add to Home Screen** (iOS Safari) or **⋮ → Add to Home screen / Install app** (Android Chrome). It runs full-screen and works offline after the first load.

Patterns, settings and cables are saved in the browser's local storage. Loaded tracks are not stored.

## AI stems (beta) notes

- Needs the hosted (GitHub Pages) version and a network the first time: it downloads onnxruntime-web from jsDelivr and the ~172 MB `htdemucs_embedded.onnx` model from Hugging Face, then caches the model in the browser.
- Uses WebGPU when the browser has it (fast), otherwise WASM (single-threaded, usually slower than real time). The status line shows the speed as a real-time multiple. Below 1x, AI stems only appear where it has caught up; separation always starts at the playhead and follows it if you seek.
- Memory: about 40 MB per minute of track for the stems, plus the model. Long tracks can run out of memory on phones.
- Separation code is adapted from [demucs-web](https://www.npmjs.com/package/demucs-web) (MIT) around Meta's HTDemucs. Only use it on audio you have the right to process.
