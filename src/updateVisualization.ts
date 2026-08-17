import { computeHierarchicalAverages } from "./analysis/computeHierarchicalAverages";
import { GLSLRenderer } from "./renderer/glslRenderer";
import { getMicInputStream, getAudioInputDevices } from "./audio/getMicInputStream";
import { MidiController } from "./midi/midiController";

declare const canvas: HTMLCanvasElement;
declare const micInput: HTMLSelectElement;
declare const midiInput: HTMLSelectElement;
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

  // Audio state
  let audioStop: (() => void) | null = null;
  let getTimeDomainData: (() => Float32Array) | null = null;

  // MIDI setup
  const midi = new MidiController(0);
  await midi.init();

  // MIDI target wrapper combining renderer + UI controls
  const midiTarget = {
    setRotationX: (v: number) => renderer.setRotationX(v),
    setRotationY: (v: number) => renderer.setRotationY(v),
    setDistance: (v: number) => renderer.setDistance(v),
    setPanX: (v: number) => renderer.setPanX(v),
    setPanY: (v: number) => renderer.setPanY(v),
    setIntensityMultiplier: (v: number) => {
      intensityMultiplier.value = String(v);
      intensityMultiplier.dispatchEvent(new Event('input'));
    },
    setClamp: (v: number) => {
      clamp.value = String(v);
      clamp.dispatchEvent(new Event('input'));
    },
  };

  midi.bind(midiTarget);

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

  // Populate MIDI input dropdown
  const populateMidiDevices = () => {
    const devices = midi.getInputDevices();
    const currentValue = midiInput.value;

    midiInput.innerHTML = '<option value="">Select MIDI input...</option>';
    devices.forEach((device) => {
      const option = document.createElement('option');
      option.value = device.id;
      option.textContent = device.name;
      midiInput.appendChild(option);
    });

    // Restore selection if still available
    if (currentValue && devices.some((d) => d.id === currentValue)) {
      midiInput.value = currentValue;
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

  midiInput.addEventListener('change', () => {
    midi.selectInput(midiInput.value || null);
  });

  // Listen for device changes
  navigator.mediaDevices.addEventListener('devicechange', populateMicDevices);
  midi.onDeviceChange(populateMidiDevices);

  // Initial population
  await populateMicDevices();
  populateMidiDevices();

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
