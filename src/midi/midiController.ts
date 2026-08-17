export interface MidiInputDevice {
  id: string;
  name: string;
}

export interface MidiControllerTarget {
  setRotationX(value: number): void;
  setRotationY(value: number): void;
  setDistance(value: number): void;
  setPanX?(value: number): void;
  setPanY?(value: number): void;
  setIntensityMultiplier?(value: number): void;
  setClamp?(value: number): void;
}

export interface MidiMapping {
  cc: number;
  min: number;
  max: number;
  setter: keyof MidiControllerTarget;
}

const DEFAULT_MAPPINGS: MidiMapping[] = [
  { cc: 0, min: 100, max: 3000, setter: 'setDistance' },      // Zoom
  { cc: 1, min: -Math.PI / 2, max: Math.PI / 2, setter: 'setRotationX' },  // Rotation X
  { cc: 2, min: -Math.PI, max: Math.PI, setter: 'setRotationY' },          // Rotation Y
  { cc: 3, min: -500, max: 500, setter: 'setPanX' },          // Pan X
  { cc: 4, min: -500, max: 500, setter: 'setPanY' },          // Pan Y
  { cc: 5, min: 1, max: 100, setter: 'setIntensityMultiplier' },  // Intensity
  { cc: 6, min: 0, max: 1, setter: 'setClamp' },              // Clamp
];

export class MidiController {
  private midiAccess: MIDIAccess | null = null;
  private target: MidiControllerTarget | null = null;
  private mappings: MidiMapping[];
  private channel: number;
  private activeInput: MIDIInput | null = null;
  private onDeviceChangeCallback: (() => void) | null = null;

  constructor(channel: number = 0, mappings: MidiMapping[] = DEFAULT_MAPPINGS) {
    this.channel = channel;
    this.mappings = mappings;
  }

  async init(): Promise<boolean> {
    if (!navigator.requestMIDIAccess) {
      console.warn('Web MIDI API not supported');
      return false;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess();

      this.midiAccess.onstatechange = () => {
        if (this.onDeviceChangeCallback) {
          this.onDeviceChangeCallback();
        }
      };

      return true;
    } catch (err) {
      console.error('MIDI access denied:', err);
      return false;
    }
  }

  getInputDevices(): MidiInputDevice[] {
    if (!this.midiAccess) return [];

    const devices: MidiInputDevice[] = [];
    this.midiAccess.inputs.forEach((input) => {
      devices.push({
        id: input.id,
        name: input.name || `MIDI Input ${input.id}`,
      });
    });
    return devices;
  }

  selectInput(deviceId: string | null): void {
    // Disconnect previous input
    if (this.activeInput) {
      this.activeInput.onmidimessage = null;
      this.activeInput = null;
    }

    if (!deviceId || !this.midiAccess) return;

    const input = this.midiAccess.inputs.get(deviceId);
    if (input) {
      this.activeInput = input;
      input.onmidimessage = this.handleMidiMessage.bind(this);
      console.log(`MIDI input selected: ${input.name}`);
    }
  }

  onDeviceChange(callback: () => void): void {
    this.onDeviceChangeCallback = callback;
  }

  bind(target: MidiControllerTarget): void {
    this.target = target;
  }

  private handleMidiMessage(event: MIDIMessageEvent): void {
    const [status, cc, value] = event.data!;

    // Check for CC message (0xB0-0xBF)
    const messageType = status & 0xf0;
    const messageChannel = status & 0x0f;

    if (messageType !== 0xb0 || messageChannel !== this.channel) {
      return;
    }

    if (cc < 0 || cc > 16) return;

    const mapping = this.mappings.find((m) => m.cc === cc);
    if (!mapping || !this.target) return;

    // Map 0-127 to min-max
    const normalized = value / 127;
    const mapped = mapping.min + normalized * (mapping.max - mapping.min);

    const setter = this.target[mapping.setter];
    if (typeof setter === 'function') {
      setter.call(this.target, mapped);
    }
  }

  setMapping(cc: number, min: number, max: number, setter: keyof MidiControllerTarget): void {
    const existing = this.mappings.find((m) => m.cc === cc);
    if (existing) {
      existing.min = min;
      existing.max = max;
      existing.setter = setter;
    } else {
      this.mappings.push({ cc, min, max, setter });
    }
  }
}
