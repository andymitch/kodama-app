<script lang="ts">
  import { getTransport } from '$lib/transport-ws.js';
  import type { AudioDataEvent } from '$lib/types.js';

  let { sourceId, muted = true }: { sourceId: string; muted?: boolean } = $props();

  let audioContext: AudioContext | null = null;
  let gainNode: GainNode | null = null;
  let workletNode: AudioWorkletNode | null = null;
  let workletReady = false;
  let initInProgress = false;
  let sampleRateHint = 0;

  // When muted changes, update gain or initialize audio on first unmute
  $effect(() => {
    if (gainNode) {
      gainNode.gain.value = muted ? 0 : 1;
    }
    if (!muted && !workletReady && !initInProgress && sampleRateHint > 0) {
      ensureWorklet(sampleRateHint);
    }
    if (!muted && audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }
  });

  async function ensureWorklet(sampleRate: number): Promise<void> {
    if (workletReady || initInProgress) return;
    initInProgress = true;

    try {
      audioContext = new AudioContext({ sampleRate });
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      await audioContext.audioWorklet.addModule('/pcm-worklet-processor.js');
      workletNode = new AudioWorkletNode(audioContext, 'pcm-worklet-processor', {
        outputChannelCount: [2],
      });
      gainNode = audioContext.createGain();
      gainNode.gain.value = muted ? 0 : 1;
      workletNode.connect(gainNode);
      gainNode.connect(audioContext.destination);
      workletReady = true;
    } catch (e) {
      console.error('[AudioPlayer] Failed to initialize AudioWorklet:', e);
      initInProgress = false;
    }
  }

  function handleAudioData(event: AudioDataEvent) {
    if (event.source_id !== sourceId) return;

    // Remember sample rate for deferred init
    if (sampleRateHint === 0) {
      sampleRateHint = event.sample_rate;
    }

    // Don't process audio when muted — skip worklet init and data transfer
    if (muted) return;

    if (!workletReady) {
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
      // Buffer may have been neutered — not fatal
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
      initInProgress = false;
      sampleRateHint = 0;
    };
  });
</script>

<!-- Audio player is invisible - just plays audio -->
<div class="hidden"></div>
