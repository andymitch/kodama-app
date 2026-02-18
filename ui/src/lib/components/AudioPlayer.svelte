<script lang="ts">
  import { getTransport } from '$lib/transport-ws.js';
  import type { AudioDataEvent } from '$lib/types.js';

  let { sourceId, muted = true }: { sourceId: string; muted?: boolean } = $props();

  let audioContext: AudioContext | null = null;
  let gainNode: GainNode | null = null;
  let nextPlayTime = 0;

  $effect(() => {
    if (gainNode) {
      gainNode.gain.value = muted ? 0 : 1;
    }
  });

  function playAudioChunk(pcmData: ArrayBuffer, sampleRate: number, channels: number) {
    if (!audioContext) {
      audioContext = new AudioContext();
      gainNode = audioContext.createGain();
      gainNode.gain.value = muted ? 0 : 1;
      gainNode.connect(audioContext.destination);
      nextPlayTime = audioContext.currentTime;
    }

    const int16Array = new Int16Array(pcmData);
    const floatArray = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      floatArray[i] = int16Array[i] / 32768.0;
    }

    const audioBuffer = audioContext.createBuffer(channels, floatArray.length, sampleRate);
    audioBuffer.getChannelData(0).set(floatArray);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gainNode!);

    const scheduleTime = Math.max(nextPlayTime, audioContext.currentTime);
    source.start(scheduleTime);
    nextPlayTime = scheduleTime + audioBuffer.duration;
  }

  function handleAudioData(event: AudioDataEvent) {
    if (event.source_id !== sourceId) return;
    try {
      playAudioChunk(event.data, event.sample_rate, event.channels);
    } catch (e) {
      console.error('[AudioPlayer] Failed to play audio:', e);
    }
  }

  $effect(() => {
    const transport = getTransport();
    const unlisten = transport.on('audio-data', handleAudioData);
    return () => {
      unlisten();
      if (audioContext) {
        audioContext.close();
      }
    };
  });
</script>

<!-- Audio player is invisible - just plays audio -->
<div class="hidden"></div>
