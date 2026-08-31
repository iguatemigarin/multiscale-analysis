import { computeHierarchicalAverages } from "./analysis/computeHierarchicalAverages";
import { GLSLRenderer } from "./renderer/glslRenderer";
import { getMicInputStream, getAudioInputDevices } from "./audio/getMicInputStream";
import { registerKeyboardControls } from "./controls/keyboardControls";

declare const canvas: HTMLCanvasElement;
declare const micInput: HTMLSelectElement;
declare const intensityMultiplier: HTMLInputElement;
declare const clamp: HTMLInputElement;

const SAMPLE_SIZE = 2 ** 13;

export const updateVisualization = async () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const renderer = new GLSLRenderer(canvas);
  canvas.addEventListener('dblclick', () => {
    if (!document.fullscreenElement) {
      canvas.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  });

  registerKeyboardControls();

  // Audio state
  let audioStop: (() => void) | null = null;
  let getTimeDomainData: (() => Float32Array) | null = null;

  // Populate mic input dropdown
  const populateMicDevices = async () => {
    const devices = await getAudioInputDevices();
    const currentValue = micInput.value;

    micInput.innerHTML = '<option value="">Select audio input...</option>';
    devices.forEach((device) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Mic ${device.deviceId.slice(0, 8)}`;
      micInput.appendChild(option);
    });

    // Restore selection if still available
    if (currentValue && devices.some((d) => d.deviceId === currentValue)) {
      micInput.value = currentValue;
    }
  };

  // Handle mic selection
  const startAudio = async (deviceId: string) => {
    if (audioStop) {
      audioStop();
      audioStop = null;
      getTimeDomainData = null;
    }

    if (!deviceId) return;

    try {
      const result = await getMicInputStream(SAMPLE_SIZE, deviceId);
      audioStop = result.stop;
      getTimeDomainData = result.getTimeDomainData;
    } catch (err) {
      console.error('Failed to start audio:', err);
      micInput.value = '';
    }
  };

  micInput.addEventListener('change', () => {
    startAudio(micInput.value);
  });

  // Listen for device changes
  navigator.mediaDevices.addEventListener('devicechange', populateMicDevices);

  // Initial population
  await populateMicDevices();

  window.addEventListener('resize', () => {
    renderer.resize();
  });

  const emptyBuffer = new Float32Array(SAMPLE_SIZE);

  const loop = () => {
    const samples = getTimeDomainData ? getTimeDomainData() : emptyBuffer;

    renderer.render(
      computeHierarchicalAverages(samples as Float32Array<ArrayBuffer>),
      SAMPLE_SIZE
    );

    setTimeout(loop, 1000 / 12);
  };

  loop();

  return () => {
    if (audioStop) audioStop();
  };
};
