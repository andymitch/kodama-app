/**
 * AudioWorklet processor for PCM playback.
 *
 * Receives Int16 PCM chunks via MessagePort, converts to Float32,
 * deinterleaves multichannel audio, and feeds a ring buffer that
 * the audio rendering thread pulls from.
 *
 * Handles clock drift by trimming the buffer when it grows too large.
 */
class PCMWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // Ring buffer sized for ~1s at 48kHz stereo (worst case)
    this.bufferSize = 48000 * 2;
    this.ringBuffer = new Float32Array(this.bufferSize);
    this.writePos = 0;
    this.readPos = 0;
    this.channels = 1;

    // Drift correction: max buffered samples before trimming (~200ms at 48kHz mono)
    this.maxBufferedSamples = 48000 * 0.2;

    this.port.onmessage = (e) => {
      const { pcmData, channels, sampleRate } = e.data;
      this.channels = channels;
      // Update max buffer based on actual sample rate (~200ms worth)
      this.maxBufferedSamples = Math.floor(sampleRate * 0.2) * channels;

      const int16 = new Int16Array(pcmData);

      // Check available space; if adding this chunk would exceed drift
      // threshold, trim oldest data first
      let buffered = this.writePos - this.readPos;
      if (buffered < 0) buffered += this.bufferSize;

      if (buffered + int16.length > this.maxBufferedSamples) {
        // Skip ahead: drop oldest samples to make room
        const excess = buffered + int16.length - this.maxBufferedSamples;
        this.readPos = (this.readPos + excess) % this.bufferSize;
      }

      // Convert Int16 to Float32 and write into ring buffer
      for (let i = 0; i < int16.length; i++) {
        this.ringBuffer[this.writePos] = int16[i] / 32768.0;
        this.writePos = (this.writePos + 1) % this.bufferSize;
      }
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const frameSize = output[0].length; // 128 samples per render quantum
    const numOutputChannels = output.length;
    const srcChannels = this.channels;
    const samplesNeeded = frameSize * srcChannels;

    // Calculate available samples in ring buffer
    let available = this.writePos - this.readPos;
    if (available < 0) available += this.bufferSize;

    if (available < samplesNeeded) {
      // Underrun: output silence (buffers are already zero-filled)
      return true;
    }

    if (srcChannels > 1) {
      // Deinterleave: input is [L0,R0,L1,R1,...] -> output[0]=[L0,L1,...], output[1]=[R0,R1,...]
      for (let i = 0; i < frameSize; i++) {
        for (let ch = 0; ch < srcChannels; ch++) {
          const sample = this.ringBuffer[this.readPos];
          this.readPos = (this.readPos + 1) % this.bufferSize;
          if (ch < numOutputChannels) {
            output[ch][i] = sample;
          }
          // If srcChannels > numOutputChannels, extra channels are discarded
        }
      }
    } else {
      // Mono: write to first channel only
      for (let i = 0; i < frameSize; i++) {
        output[0][i] = this.ringBuffer[this.readPos];
        this.readPos = (this.readPos + 1) % this.bufferSize;
      }
    }

    return true;
  }
}

registerProcessor('pcm-worklet-processor', PCMWorkletProcessor);
