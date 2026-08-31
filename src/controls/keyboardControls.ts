declare const viewMode: HTMLSelectElement;
declare const visualScaleGrading: HTMLSelectElement;
declare const intensityMultiplier: HTMLInputElement;
declare const clamp: HTMLInputElement;

// The renderer reads these controls on every frame, so a binding only needs to
// assign `.value` for it to take effect.
const bindings: Record<string, () => void> = {
  '1': () => { viewMode.value = 'averages'; },
  '2': () => { viewMode.value = 'parentAvg'; },
  '3': () => { visualScaleGrading.value = 'mono'; },
  '4': () => { visualScaleGrading.value = 'color'; },
};

// How long holding an arrow key takes to sweep a slider end to end. The rate is
// derived from each slider's own range, so Intensity (1–100) and Clamp (0–1)
// move at the same apparent speed despite the very different scales.
const SWEEP_SECONDS = 5;

interface SliderRamp {
  increase: string;
  decrease: string;
  slider: () => HTMLInputElement;
}

const ramps: SliderRamp[] = [
  { increase: 'ArrowUp', decrease: 'ArrowDown', slider: () => intensityMultiplier },
  { increase: 'ArrowRight', decrease: 'ArrowLeft', slider: () => clamp },
];

const rampKeys = new Set(ramps.flatMap((ramp) => [ramp.increase, ramp.decrease]));

const heldKeys = new Set<string>();
let ramping = false;
let lastFrameTime = 0;

const rampFrame = (time: number): void => {
  const elapsed = (time - lastFrameTime) / 1000;
  lastFrameTime = time;

  let active = false;

  for (const ramp of ramps) {
    const direction =
      (heldKeys.has(ramp.increase) ? 1 : 0) - (heldKeys.has(ramp.decrease) ? 1 : 0);
    if (direction === 0) continue;
    active = true;

    const slider = ramp.slider();
    const min = Number(slider.min);
    const max = Number(slider.max);
    const next = Number(slider.value) + direction * ((max - min) / SWEEP_SECONDS) * elapsed;

    // The input snaps whatever it's given to its own `step`, so the sliders stay
    // on tidy values without this needing to know their step sizes.
    slider.value = String(Math.min(max, Math.max(min, next)));
  }

  if (!active) {
    ramping = false;
    return;
  }

  requestAnimationFrame(rampFrame);
};

export const registerKeyboardControls = (): void => {
  window.addEventListener('keydown', (event) => {
    // Leave browser and OS shortcuts alone (Cmd+1 switches tabs, etc.)
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (rampKeys.has(event.key)) {
      heldKeys.add(event.key);
      if (!ramping) {
        ramping = true;
        lastFrameTime = performance.now();
        requestAnimationFrame(rampFrame);
      }
      // Otherwise a focused select would step through its own options.
      event.preventDefault();
      return;
    }

    const binding = bindings[event.key];
    if (!binding) return;

    binding();
    event.preventDefault();
  });

  window.addEventListener('keyup', (event) => {
    heldKeys.delete(event.key);
  });

  // A keyup is never delivered if focus leaves mid-hold, which would otherwise
  // leave a ramp running forever.
  window.addEventListener('blur', () => {
    heldKeys.clear();
  });
};
