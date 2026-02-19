import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- Mock AudioWorkletProcessor base class ----------

let registeredProcessors: Record<string, any> = {};

// These must be defined before importing the processor
(globalThis as any).AudioWorkletProcessor = class {
  port = { onmessage: null as ((e: any) => void) | null };
};
(globalThis as any).registerProcessor = (name: string, cls: any) => {
  registeredProcessors[name] = cls;
};
(globalThis as any).sampleRate = 48000;

// Import the processor (runs registerProcessor as a side effect)
// We eval it since it's a plain JS file not an ES module
import { readFileSync } from 'fs';
import { resolve } from 'path';

const processorCode = readFileSync(resolve(__dirname, '../../../public/pcm-worklet-processor.js'), 'utf-8');
eval(processorCode);

function createProcessor(): any {
  const Cls = registeredProcessors['pcm-worklet-processor'];
  return new Cls();
}

function makeOutput(channels: number, frameSize = 128): Float32Array[][] {
  return [
    Array.from({ length: channels }, () => new Float32Array(frameSize)),
  ];
}

function postAudio(proc: any, int16Data: number[], channels = 1, sampleRate = 48000) {
  const int16 = new Int16Array(int16Data);
  proc.port.onmessage?.({
    data: { pcmData: int16.buffer, channels, sampleRate },
  });
}

// ---------- Tests ----------

describe('PCMWorkletProcessor', () => {
  beforeEach(() => {
    // Re-register fresh
    registeredProcessors = {};
    eval(processorCode);
  });

  it('registers as pcm-worklet-processor', () => {
    expect(registeredProcessors['pcm-worklet-processor']).toBeDefined();
  });

  // ---- Int16 to Float32 conversion ----

  describe('Int16 to Float32 conversion', () => {
    it('converts zero correctly', () => {
      const proc = createProcessor();
      postAudio(proc, [0]);
      const outputs = makeOutput(1, 1);
      proc.process([], outputs);
      expect(outputs[0][0][0]).toBe(0);
    });

    it('converts positive max (32767) to ~1.0', () => {
      const proc = createProcessor();
      postAudio(proc, [32767]);
      const outputs = makeOutput(1, 1);
      proc.process([], outputs);
      expect(outputs[0][0][0]).toBeCloseTo(32767 / 32768, 4);
    });

    it('converts negative max (-32768) to -1.0', () => {
      const proc = createProcessor();
      postAudio(proc, [-32768]);
      const outputs = makeOutput(1, 1);
      proc.process([], outputs);
      expect(outputs[0][0][0]).toBeCloseTo(-1.0, 4);
    });

    it('converts mid-range values correctly', () => {
      const proc = createProcessor();
      postAudio(proc, [16384]); // ~0.5
      const outputs = makeOutput(1, 1);
      proc.process([], outputs);
      expect(outputs[0][0][0]).toBeCloseTo(0.5, 2);
    });
  });

  // ---- Ring buffer ----

  describe('ring buffer', () => {
    it('writes and reads sequentially', () => {
      const proc = createProcessor();
      // Post 128 mono samples
      const data = Array.from({ length: 128 }, (_, i) => i * 100);
      postAudio(proc, data);

      const outputs = makeOutput(1, 128);
      proc.process([], outputs);

      for (let i = 0; i < 128; i++) {
        expect(outputs[0][0][i]).toBeCloseTo(data[i] / 32768, 3);
      }
    });

    it('handles multiple writes before read', () => {
      const proc = createProcessor();
      postAudio(proc, [1000, 2000]);
      postAudio(proc, [3000, 4000]);

      const outputs = makeOutput(1, 4);
      proc.process([], outputs);

      expect(outputs[0][0][0]).toBeCloseTo(1000 / 32768, 3);
      expect(outputs[0][0][1]).toBeCloseTo(2000 / 32768, 3);
      expect(outputs[0][0][2]).toBeCloseTo(3000 / 32768, 3);
      expect(outputs[0][0][3]).toBeCloseTo(4000 / 32768, 3);
    });

    it('handles wrap-around correctly', () => {
      const proc = createProcessor();
      // Fill most of the buffer to force a wrap-around
      // Buffer is 96000 (48000*2). Write near the end, then wrap.
      // We can't easily fill 96k samples, but we can set writePos manually.
      proc.writePos = 96000 - 2;
      proc.readPos = 96000 - 2;

      postAudio(proc, [1000, 2000, 3000, 4000]);
      // writePos should have wrapped around

      const outputs = makeOutput(1, 4);
      proc.process([], outputs);

      expect(outputs[0][0][0]).toBeCloseTo(1000 / 32768, 3);
      expect(outputs[0][0][1]).toBeCloseTo(2000 / 32768, 3);
      expect(outputs[0][0][2]).toBeCloseTo(3000 / 32768, 3);
      expect(outputs[0][0][3]).toBeCloseTo(4000 / 32768, 3);
    });
  });

  // ---- Underrun ----

  describe('underrun', () => {
    it('outputs silence when buffer is empty', () => {
      const proc = createProcessor();
      const outputs = makeOutput(1, 128);
      // Fill with non-zero to verify they stay zeroed
      outputs[0][0].fill(999);

      proc.process([], outputs);

      // With no data posted, buffer is empty -> should not modify output
      // (outputs are zero-filled by the audio system, but our test pre-filled them)
      // The processor returns true without writing = silence
      expect(outputs[0][0][0]).toBe(999); // not modified (underrun path)
    });

    it('outputs silence when not enough samples', () => {
      const proc = createProcessor();
      postAudio(proc, [1000]); // Only 1 sample, but need 128

      const outputs = makeOutput(1, 128);
      outputs[0][0].fill(999);
      proc.process([], outputs);

      // Not enough samples -> underrun, output untouched
      expect(outputs[0][0][0]).toBe(999);
    });
  });

  // ---- Multichannel deinterleaving ----

  describe('stereo deinterleaving', () => {
    it('deinterleaves L/R correctly', () => {
      const proc = createProcessor();
      // Stereo: [L0, R0, L1, R1, L2, R2, L3, R3]
      const data = [
        1000, 2000,  // frame 0: L=1000, R=2000
        3000, 4000,  // frame 1: L=3000, R=4000
        5000, 6000,  // frame 2
        7000, 8000,  // frame 3
      ];
      postAudio(proc, data, 2);

      const outputs = makeOutput(2, 4);
      proc.process([], outputs);

      // Left channel
      expect(outputs[0][0][0]).toBeCloseTo(1000 / 32768, 3);
      expect(outputs[0][0][1]).toBeCloseTo(3000 / 32768, 3);
      expect(outputs[0][0][2]).toBeCloseTo(5000 / 32768, 3);
      expect(outputs[0][0][3]).toBeCloseTo(7000 / 32768, 3);

      // Right channel
      expect(outputs[0][1][0]).toBeCloseTo(2000 / 32768, 3);
      expect(outputs[0][1][1]).toBeCloseTo(4000 / 32768, 3);
      expect(outputs[0][1][2]).toBeCloseTo(6000 / 32768, 3);
      expect(outputs[0][1][3]).toBeCloseTo(8000 / 32768, 3);
    });

    it('discards extra channels when output has fewer', () => {
      const proc = createProcessor();
      // 3-channel source, but only 2 output channels
      const data = [
        1000, 2000, 3000,  // frame 0
        4000, 5000, 6000,  // frame 1
      ];
      postAudio(proc, data, 3);

      const outputs = makeOutput(2, 2);
      proc.process([], outputs);

      // Only first 2 channels should be populated
      expect(outputs[0][0][0]).toBeCloseTo(1000 / 32768, 3);
      expect(outputs[0][0][1]).toBeCloseTo(4000 / 32768, 3);
      expect(outputs[0][1][0]).toBeCloseTo(2000 / 32768, 3);
      expect(outputs[0][1][1]).toBeCloseTo(5000 / 32768, 3);
    });
  });

  // ---- Drift correction ----

  describe('drift correction', () => {
    it('trims buffer when exceeding max threshold', () => {
      const proc = createProcessor();
      // maxBufferedSamples = floor(48000 * 0.2) * 1 = 9600 for mono
      // Post more than 9600 samples
      const bigChunk = Array.from({ length: 5000 }, (_, i) => i % 32767);
      postAudio(proc, bigChunk);
      postAudio(proc, bigChunk);
      // Now we have 10000 samples, which exceeds 9600

      // The second write should have trimmed the buffer
      let available = proc.writePos - proc.readPos;
      if (available < 0) available += proc.bufferSize;
      expect(available).toBeLessThanOrEqual(9600);
    });

    it('does not trim when under threshold', () => {
      const proc = createProcessor();
      const smallChunk = Array.from({ length: 100 }, (_, i) => i * 10);
      postAudio(proc, smallChunk);

      let available = proc.writePos - proc.readPos;
      if (available < 0) available += proc.bufferSize;
      expect(available).toBe(100);
    });

    it('updates maxBufferedSamples based on sample rate', () => {
      const proc = createProcessor();
      // Default is 48000 * 0.2 = 9600
      postAudio(proc, [100], 1, 16000);
      // Should update to floor(16000 * 0.2) * 1 = 3200
      expect(proc.maxBufferedSamples).toBe(3200);
    });

    it('accounts for channel count in max threshold', () => {
      const proc = createProcessor();
      postAudio(proc, [100, 200], 2, 48000);
      // maxBufferedSamples = floor(48000 * 0.2) * 2 = 19200
      expect(proc.maxBufferedSamples).toBe(19200);
    });
  });

  // ---- Process return value ----

  describe('process()', () => {
    it('always returns true to keep processor alive', () => {
      const proc = createProcessor();
      const outputs = makeOutput(1, 128);
      expect(proc.process([], outputs)).toBe(true);

      postAudio(proc, Array.from({ length: 128 }, () => 100));
      expect(proc.process([], outputs)).toBe(true);
    });

    it('handles empty output gracefully', () => {
      const proc = createProcessor();
      expect(proc.process([], [[]])).toBe(true);
      expect(proc.process([], [undefined as any])).toBe(true);
    });
  });

  // ---- Consecutive process calls ----

  describe('consecutive processing', () => {
    it('drains buffer across multiple process() calls', () => {
      const proc = createProcessor();
      // Post 256 mono samples
      const data = Array.from({ length: 256 }, (_, i) => (i % 100) * 100);
      postAudio(proc, data);

      // First process: read 128
      const out1 = makeOutput(1, 128);
      proc.process([], out1);
      expect(out1[0][0][0]).toBeCloseTo(data[0] / 32768, 3);
      expect(out1[0][0][127]).toBeCloseTo(data[127] / 32768, 3);

      // Second process: read next 128
      const out2 = makeOutput(1, 128);
      proc.process([], out2);
      expect(out2[0][0][0]).toBeCloseTo(data[128] / 32768, 3);
      expect(out2[0][0][127]).toBeCloseTo(data[255] / 32768, 3);

      // Third process: buffer empty -> underrun
      const out3 = makeOutput(1, 128);
      out3[0][0].fill(999);
      proc.process([], out3);
      expect(out3[0][0][0]).toBe(999); // untouched
    });
  });
});
