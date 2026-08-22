import { describe, expect, it } from "vitest";
import { encodeMonoPcmWav } from "./wav";

describe("recorded audio conversion", () => {
  it("encodes real sample frames as an accepted WAV payload", async () => {
    const blob = encodeMonoPcmWav([new Float32Array([0, 0.5, -0.5, 0])], 16000);
    expect(blob.type).toBe("audio/wav");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
    expect(bytes.byteLength).toBe(52);
  });
});
