# multiscale-analysis

A real-time WebGL2 visualizer for live audio. It takes a window of microphone
samples, recursively halves it into a binary tree of averages, and renders every
node of that tree as an instanced 3D bar — so you see the signal at all scales at
once, from the full window down to individual samples.

## How it works

1. **Capture** — an `AudioWorklet` (`src/audio/audioProcessor.js`) streams raw
   time-domain chunks from the selected input device into a ring buffer of 8192
   samples (`SAMPLE_SIZE = 2 ** 13`). Writes are exponentially smoothed
   (`alpha = 0.09`) so the buffer decays rather than jumping between frames.
2. **Analyze** — `normalizeArray` rescales the buffer to `[0, 1]`, then
   `computeHierarchicalAverages` builds a binary tree via a prefix-sum: the root
   covers the whole window, each child covers half of its parent, down to
   single-sample leaves. 14 levels, 16383 nodes.
3. **Render** — `GLSLRenderer` flattens the tree into per-instance data
   (`x, y, w, h` + `intensity, parentIntensity`) and draws all nodes in a single
   `drawElementsInstanced` call. Each level is a horizontal band; bar height
   (extrusion along Z) and color both come from intensity, with simple diffuse
   lighting. The instance cap is 16384.

The render loop runs at a fixed ~12 fps (`setTimeout(loop, 1000 / 12)`).

## Requirements

- Node.js with npm
- A browser with **WebGL2**, **AudioWorklet**, and — for MIDI control —
  **Web MIDI** (Chromium-based browsers). MIDI is optional; without it the app
  logs a warning and runs normally.
- Microphone permission (requested on load, to enumerate labeled input devices).

## Running

```bash
npm install
npm run dev      # or: make start
```

Then open the URL Vite prints and pick an input from the **Mic** dropdown —
nothing is drawn until an audio device is selected.

Other scripts:

```bash
npm run build    # tsc --noEmit type check, then vite build
npm run preview  # serve the production build
```

The build uses `rolldown-vite` pinned in place of `vite` via `overrides`.

## Controls

**Mouse / touch** (on the canvas)

| Action | Effect |
| --- | --- |
| Drag | Orbit (rotation X clamped to ±π/2) |
| Wheel | Zoom (distance clamped to 100–3000) |
| Double-click | Toggle fullscreen |

**UI panel**

- **Mic** / **MIDI** — input device selection; both lists repopulate on device
  hotplug.
- **View** — `Averages` shows each node's raw average; `Averages Delta (from
  parent)` shows the difference between a node and its parent, which highlights
  where the signal diverges from its coarser scale. Delta is the default.
- **Scale Grading** — `Color` maps intensity to hue; `Monochromatic` maps it to
  luminance.
- **Intensity** — multiplier applied to intensity before coloring and extrusion
  (halved in `Averages` mode).
- **Clamp** — lower bound applied to intensity (`max(clamp, intensity)`),
  flattening everything below the threshold.

**MIDI** — CC messages on channel 0 (`src/midi/midiController.ts`):

| CC | Target | Range |
| --- | --- | --- |
| 0 | Distance / zoom | 100 → 3000 |
| 1 | Rotation X | −π/2 → π/2 |
| 2 | Rotation Y | −π → π |
| 3 | Pan X | −500 → 500 |
| 4 | Pan Y | −500 → 500 |
| 5 | Intensity | 1 → 100 |
| 6 | Clamp | 0 → 1 |

Values are mapped linearly from the 0–127 CC range. Mappings can be changed at
runtime with `MidiController#setMapping`.

## Layout

```
index.html                              Canvas + control panel (elements are read by id)
src/main.ts                             Entry point
src/updateVisualization.ts              Wiring: devices, MIDI binding, render loop
src/analysis/normalizeArray.ts          Min/max rescale to [0, 1]
src/analysis/computeHierarchicalAverages.ts   Prefix-sum binary tree of averages
src/audio/getMicInputStream.ts          getUserMedia + worklet + ring buffer
src/audio/audioProcessor.js             AudioWorkletProcessor
src/midi/midiController.ts              Web MIDI CC → setter mapping
src/renderer/glslRenderer.ts            WebGL2 instanced renderer, camera, orbit controls
src/renderer/shaders/*.glsl             Vertex (extrusion) and fragment (color/lighting)
```

Note that the DOM controls are reached through implicit global bindings on
element `id` (`declare const canvas: HTMLCanvasElement`, etc.) rather than
`getElementById`, so the ids in `index.html` are part of the module contract.
