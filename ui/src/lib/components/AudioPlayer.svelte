<script lang="ts">
  import { getTransport } from '$lib/transport-ws.js';
  import type { AudioDataEvent } from '$lib/types.js';

  let { sourceId, muted = true }: { sourceId: string; muted?: boolean } = $props();

  let audioContext: AudioContext | null = null;
  let gainNode: GainNode | null = null;
  let workletNode: AudioWorkletNode | null = null;
  let workletReady = false;
  let initInProgress = false;
  let pendingChunks: AudioDataEvent[] = [];

  $effect(() => {
    if (gainNode) {
      gainNode.gain.value = muted ? 0 : 1;
    }
  });

  async function ensureWorklet(sampleRate: number): Promise<void> {
    if (workletReady || initInProgress) return;
    initInProgress = true;

    audioContext = new AudioContext({ sampleRate });
    await audioContext.audioWorklet.addModule('/pcm-worklet-processor.js');
    workletNode = new AudioWorkletNode(audioContext, 'pcm-worklet-processor', {
      outputChannelCount: [2],
    });
    gainNode = audioContext.createGain();
    gainNode.gain.value = muted ? 0 : 1;
    workletNode.connect(gainNode);
    gainNode.connect(audioContext.destination);
    workletReady = true;

    // Flush any chunks that arrived before the worklet was ready
    for (const chunk of pendingChunks) {
      workletNode.port.postMessage(
        { pcmData: chunk.data, channels: chunk.channels, sampleRate: chunk.sample_rate },
        [chunk.data],
      );
    }
    pendingChunks = [];
  }

  function handleAudioData(event: AudioDataEvent) {
    if (event.source_id !== sourceId) return;

    if (!workletReady) {
      // Queue while worklet is initializing; clone the buffer since
      // the original may be neutered by a prior transfer
      pendingChunks.push(event);
      ensureWorklet(event.sample_rate).catch((e) => {
        console.error('[AudioPlayer] Failed to initialize AudioWorklet:', e);
      });
      return;
    }

    try {
      workletNode!.port.postMessage(
        { pcmData: event.data, channels: event.channels, sampleRate: event.sample_rate },
        [event.data],
      );
    } catch (e) {
      console.error('[AudioPlayer] Failed to send audio to worklet:', e);
    }
  }

  $effect(() => {
    const transport = getTransport();
    const unlisten = transport.on('audio-data', handleAudioData);
    return () => {
      unlisten();
      if (workletNode) {
        workletNode.disconnect();
        workletNode = null;
      }
      if (gainNode) {
        gainNode.disconnect();
        gainNode = null;
      }
      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }
      workletReady = false;
      pendingChunks = [];
    };
  });
</script>

<!-- Audio player is invisible - just plays audio -->
<div class="hidden"></div>
