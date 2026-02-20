<script lang="ts">
  import { getTransport } from '$lib/transport-ws.js';
  import { thumbnailStore } from '$lib/stores/thumbnails.svelte.js';
  import { videoStatsStore } from '$lib/stores/videoStats.svelte.js';
  import type { VideoInitEvent, VideoSegmentEvent } from '$lib/types.js';

  let { sourceId, videoElement = $bindable(undefined), active = true }: {
    sourceId: string;
    videoElement?: HTMLVideoElement;
    /** When false, video segments are discarded (for off-screen cameras) */
    active?: boolean;
  } = $props();

  let videoEl: HTMLVideoElement;
  let mediaSource: MediaSource | null = null;
  let sourceBuffer: SourceBuffer | null = null;
  let objectUrl: string = '';
  let queue: ArrayBuffer[] = [];
  const MAX_QUEUE_SIZE = 30;
  let initialized = false;
  let initInProgress = false;
  let playStarted = false;
  let mediaSegmentsAppended = 0;
  let appendErrorCount = 0;
  let droppedSegments = 0;
  let thumbnailTimer: ReturnType<typeof setInterval> | null = null;
  let thumbCanvas: HTMLCanvasElement | null = null;
  let currentCodec = '';
  let currentWidth = 0;
  let currentHeight = 0;
  /** Track recent segment sizes and timestamps for bitrate estimation */
  let recentSegmentBytes: number[] = [];
  let recentSegmentTimes: number[] = [];
  let initTimeout: ReturnType<typeof setTimeout> | null = null;
  /** Pending init event for retry after sourceopen timeout */
  let pendingInitEvent: VideoInitEvent | null = null;
  const MAX_INIT_RETRIES = 3;
  let initRetryCount = 0;

  function captureThumbnail() {
    if (!videoEl || videoEl.videoWidth === 0) return;
    if (!thumbCanvas) thumbCanvas = document.createElement('canvas');
    // 2x resolution for retina, displayed at 160x100 in PiP markers
    thumbCanvas.width = 320;
    thumbCanvas.height = 180;
    const ctx = thumbCanvas.getContext('2d');
    if (!ctx) return;
    try {
      ctx.drawImage(videoEl, 0, 0, 320, 180);
      thumbnailStore.set(sourceId, thumbCanvas.toDataURL('image/jpeg', 0.85));
    } catch {}
  }

  function tryPlay() {
    if (playStarted || !videoEl) return;
    playStarted = true;
    videoEl.play().catch((e) => {
      console.warn('[VideoPlayer] play() rejected:', e);
      playStarted = false;
    });
  }

  function getBufferedInfo(): string {
    if (!sourceBuffer || sourceBuffer.buffered.length === 0) return 'none';
    const ranges = [];
    for (let i = 0; i < sourceBuffer.buffered.length; i++) {
      ranges.push(`${sourceBuffer.buffered.start(i).toFixed(3)}-${sourceBuffer.buffered.end(i).toFixed(3)}`);
    }
    return ranges.join(', ');
  }

  function appendBuffer(data: ArrayBuffer) {
    if (!sourceBuffer) return;

    if (sourceBuffer.updating) {
      if (queue.length >= MAX_QUEUE_SIZE) {
        droppedSegments += queue.length;
        queue.length = 0;
        console.warn('[VideoPlayer] Queue overflow — flushed to live edge, total dropped:', droppedSegments);
      }
      queue.push(data);
      return;
    }

    try {
      sourceBuffer.appendBuffer(data);
    } catch (e) {
      appendErrorCount++;
      if (appendErrorCount <= 3) {
        console.error('[VideoPlayer] Failed to append buffer:', e);
      }
    }
  }

  function onUpdateEnd() {
    if (!sourceBuffer) return;

    mediaSegmentsAppended++;

    if (!playStarted && sourceBuffer.buffered.length > 0) {
      const bufferedDuration = sourceBuffer.buffered.end(0) - sourceBuffer.buffered.start(0);
      if (bufferedDuration > 0.05) {
        tryPlay();
      }
    }

    if (videoEl && playStarted && sourceBuffer.buffered.length > 0) {
      const currentTime = videoEl.currentTime;
      const bufferedEnd = sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1);
      const behind = bufferedEnd - currentTime;

      if (behind > 1) {
        videoEl.currentTime = bufferedEnd - 0.3;
      }

      if (videoEl.paused && behind > 0.1) {
        videoEl.play().catch(() => {});
      }
    }

    // Prioritize draining queued segments over buffer cleanup
    if (queue.length > 0 && !sourceBuffer.updating) {
      const next = queue.shift()!;
      try {
        sourceBuffer.appendBuffer(next);
      } catch (e) {
        appendErrorCount++;
        if (appendErrorCount <= 3) {
          console.error('Failed to append queued buffer (#' + appendErrorCount + '):', e);
        }
      }
      return;
    }

    // Only clean up old buffer data when nothing is queued
    if (videoEl && sourceBuffer.buffered.length > 0 && !sourceBuffer.updating) {
      const currentTime = videoEl.currentTime;
      const start = sourceBuffer.buffered.start(0);
      const end = sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1);

      if (currentTime - start > 5) {
        const removeEnd = Math.min(currentTime - 1, end - 0.1);
        if (removeEnd > start) {
          try {
            sourceBuffer.remove(start, removeEnd);
          } catch (e) {
            console.error('[VideoPlayer] Failed to remove buffer:', e);
          }
        }
      }
    }
  }

  function teardown() {
    if (initTimeout) { clearTimeout(initTimeout); initTimeout = null; }
    if (sourceBuffer) {
      try { sourceBuffer.removeEventListener('updateend', onUpdateEnd); } catch {}
      sourceBuffer = null;
    }
    if (mediaSource && mediaSource.readyState === 'open') {
      try { mediaSource.endOfStream(); } catch {}
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = '';
    }
    initialized = false;
    initInProgress = false;
    playStarted = false;
    queue = [];
    mediaSegmentsAppended = 0;
    appendErrorCount = 0;
    droppedSegments = 0;
    initRetryCount = 0;
    if (thumbnailTimer) { clearInterval(thumbnailTimer); thumbnailTimer = null; }
  }

  function handleInit(event: VideoInitEvent) {
    if (event.source_id !== sourceId) return;

    // If init is in progress, store this event for potential retry
    if (initInProgress) {
      pendingInitEvent = event;
      return;
    }

    if (initialized) {
      teardown();
    }

    initInProgress = true;
    pendingInitEvent = null;
    currentCodec = event.codec;
    currentWidth = event.width;
    currentHeight = event.height;
    recentSegmentBytes = [];
    recentSegmentTimes = [];

    const initData = event.init_segment;
    const codec = `video/mp4; codecs="${event.codec}"`;

    if (!MediaSource.isTypeSupported(codec)) {
      console.error('[VideoPlayer] Codec not supported:', codec);
      initInProgress = false;
      return;
    }

    mediaSource = new MediaSource();
    objectUrl = URL.createObjectURL(mediaSource);
    videoEl.src = objectUrl;

    // Timeout: if sourceopen doesn't fire within 3s, tear down and retry (up to MAX_INIT_RETRIES)
    initTimeout = setTimeout(() => {
      if (!initialized && initInProgress) {
        initRetryCount++;
        if (initRetryCount > MAX_INIT_RETRIES) {
          console.error('[VideoPlayer] sourceopen failed after', MAX_INIT_RETRIES, 'retries for', sourceId);
          teardown();
          return;
        }
        console.warn('[VideoPlayer] sourceopen timeout, retrying init for', sourceId, `(attempt ${initRetryCount}/${MAX_INIT_RETRIES})`);
        teardown();
        const retryEvent = pendingInitEvent ?? event;
        pendingInitEvent = null;
        handleInit(retryEvent);
      }
    }, 3000);

    mediaSource.addEventListener('sourceopen', () => {
      if (initTimeout) { clearTimeout(initTimeout); initTimeout = null; }
      if (!mediaSource) return;
      try {
        sourceBuffer = mediaSource.addSourceBuffer(codec);
        sourceBuffer.mode = 'sequence';
        sourceBuffer.addEventListener('updateend', onUpdateEnd);
        sourceBuffer.addEventListener('error', () => {
          console.error('[VideoPlayer] SourceBuffer error for', sourceId);
          teardown();
        });
        appendBuffer(initData);
        initialized = true;
        initInProgress = false;
        initRetryCount = 0;

        if (thumbnailTimer) clearInterval(thumbnailTimer);
        thumbnailTimer = setInterval(captureThumbnail, 1000);
      } catch (e) {
        console.error('[VideoPlayer] Failed to initialize:', e);
        teardown();
      }
    });

    mediaSource.addEventListener('error', () => {
      console.error('[VideoPlayer] MediaSource error for', sourceId);
      teardown();
    });
  }

  function handleSegment(event: VideoSegmentEvent) {
    if (event.source_id !== sourceId) return;

    // When inactive (off-screen), skip segment processing to save CPU/GPU
    if (!active) {
      droppedSegments++;
      return;
    }

    if (!initialized) {
      if (initInProgress) {
        queue.push(event.data);
      } else if (initRetryCount < MAX_INIT_RETRIES) {
        // Segments arriving with no init in progress — try recovering from cached init
        const transport = getTransport();
        const cachedInit = transport.getVideoInit(sourceId);
        if (cachedInit) {
          console.warn('[VideoPlayer] Segment-triggered init recovery for', sourceId);
          handleInit(cachedInit);
        }
      }
      return;
    }

    if (!sourceBuffer) return;

    // Track segment sizes for bitrate estimation (rolling window)
    const now = performance.now();
    recentSegmentBytes.push(event.data.byteLength);
    recentSegmentTimes.push(now);
    // Keep last ~5 seconds of data
    if (recentSegmentBytes.length > 150) {
      recentSegmentBytes = recentSegmentBytes.slice(-150);
      recentSegmentTimes = recentSegmentTimes.slice(-150);
    }

    appendBuffer(event.data);
  }

  // Expose videoEl to parent via bindable prop
  $effect(() => {
    if (videoEl) videoElement = videoEl;
  });

  // Publish video stats periodically
  $effect(() => {
    const interval = setInterval(() => {
      if (!initialized) return;
      let bufferHealth = 0;
      if (sourceBuffer && sourceBuffer.buffered.length > 0 && videoEl) {
        const end = sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1);
        bufferHealth = Math.max(0, end - videoEl.currentTime);
      }
      // Estimate bitrate from recent segments (rolling window)
      const totalBytes = recentSegmentBytes.reduce((a, b) => a + b, 0);
      const elapsed = recentSegmentTimes.length > 1
        ? (recentSegmentTimes[recentSegmentTimes.length - 1] - recentSegmentTimes[0]) / 1000
        : 0;
      const bitrateKbps = elapsed > 0 ? (totalBytes * 8) / elapsed / 1000 : 0;

      videoStatsStore.update(sourceId, {
        width: currentWidth,
        height: currentHeight,
        codec: currentCodec,
        segmentsAppended: mediaSegmentsAppended,
        droppedSegments,
        bufferHealth,
        bitrateKbps,
      });
    }, 1000);
    return () => clearInterval(interval);
  });

  $effect(() => {
    const transport = getTransport();
    const unlistenInit = transport.on('video-init', handleInit);
    const unlistenSegment = transport.on('video-segment', handleSegment);

    return () => {
      unlistenInit();
      unlistenSegment();
      teardown();
      thumbnailStore.remove(sourceId);
      videoStatsStore.remove(sourceId);
    };
  });
</script>

<video
  bind:this={videoEl}
  class="w-full h-full object-contain bg-black"
  muted
  playsinline
  onerror={() => {
    if (videoEl?.error) {
      console.warn('[VideoPlayer] Video error for', sourceId, ':', videoEl.error.message);
      // Tear down and let next video-init event re-initialize
      teardown();
    }
  }}
  onwaiting={() => {
    if (videoEl && sourceBuffer && sourceBuffer.buffered.length > 0) {
      const bufferedEnd = sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1);
      const behind = bufferedEnd - videoEl.currentTime;
      if (behind > 0.5) {
        videoEl.currentTime = bufferedEnd - 0.1;
      }
    }
  }}
  onpause={() => {
    if (videoEl && sourceBuffer && sourceBuffer.buffered.length > 0) {
      const bufferedEnd = sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1);
      if (bufferedEnd - videoEl.currentTime > 0.1) {
        videoEl.play().catch(() => {});
      }
    }
  }}
></video>
