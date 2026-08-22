export function encodeMonoPcmWav(channels: Float32Array[], sampleRate: number): Blob {
  const frameCount = channels[0]?.length ?? 0;
  const buffer = new ArrayBuffer(44 + frameCount * 2);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => { for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index)); };
  write(0, "RIFF"); view.setUint32(4, 36 + frameCount * 2, true); write(8, "WAVE"); write(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, frameCount * 2, true);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const mixed = channels.reduce((sum, channel) => sum + (channel[frame] ?? 0), 0) / Math.max(1, channels.length);
    const sample = Math.max(-1, Math.min(1, mixed));
    view.setInt16(44 + frame * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export async function convertRecordedAudioToWav(blob: Blob): Promise<Blob> {
  const Context = window.AudioContext ?? window.webkitAudioContext;
  if (!Context) throw new Error("Audio conversion is unavailable in this browser.");
  const context = new Context();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index));
    return encodeMonoPcmWav(channels, decoded.sampleRate);
  } finally { await context.close(); }
}

declare global { interface Window { webkitAudioContext?: typeof AudioContext } }
