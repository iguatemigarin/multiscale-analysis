import processorUrl from './audioProcessor.js?url';

export async function getAudioInputDevices(): Promise<MediaDeviceInfo[]> {
  // Request permission first to get labeled devices
  await navigator.mediaDevices.getUserMedia({ audio: true });
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'audioinput');
}

export async function getMicInputStream(
  bufferSize: number,
  deviceId?: string
): Promise<{
  getTimeDomainData: () => Float32Array;
  stop: () => void;
}> {
  const constraints: MediaStreamConstraints = {
    audio: deviceId ? { deviceId: { exact: deviceId } } : true,
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);

  await audioContext.audioWorklet.addModule(processorUrl);
  const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');

  const buffer = new Float32Array(bufferSize);
  let writeIndex = 0;
  const alpha = 0.09;
  workletNode.port.onmessage = (event) => {
    const chunk = event.data;
    for (let i = 0; i < chunk.length; i++) {
      buffer[writeIndex] = buffer[writeIndex] * (1 - alpha) + chunk[i] * alpha;
      writeIndex = (writeIndex + 1) % bufferSize;
    }
  };

  source.connect(workletNode);
  workletNode.connect(audioContext.destination);

  const getTimeDomainData = (): Float32Array => {
    return buffer;
  };

  const stop = () => {
    workletNode.disconnect();
    source.disconnect();
    stream.getTracks().forEach((track) => track.stop());
    audioContext.close();
  };

  return { getTimeDomainData, stop };
}
