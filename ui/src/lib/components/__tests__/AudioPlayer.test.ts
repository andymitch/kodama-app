import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import AudioPlayer from '../AudioPlayer.svelte';

vi.mock('$lib/transport-ws.js', () => import('$lib/__mocks__/transport-ws.js'));

import { getTransport, resetMockTransport } from '$lib/__mocks__/transport-ws.js';

// ---------- AudioContext / AudioWorklet mocks ----------

class MockAudioWorkletNode {
  port = {
    postMessage: vi.fn(),
  };
  connect = vi.fn();
  disconnect = vi.fn();

  constructor(_context: any, _name: string, _options?: any) {}
}

class MockAudioContext {
  static instances: MockAudioContext[] = [];

  sampleRate: number;
  audioWorklet = {
    addModule: vi.fn().mockResolvedValue(undefined),
  };
  destination = {};
  closed = false;

  constructor(options?: { sampleRate?: number }) {
    this.sampleRate = options?.sampleRate ?? 48000;
    MockAudioContext.instances.push(this);
  }

  createGain() {
    return { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } };
  }

  close() {
    this.closed = true;
    return Promise.resolve();
  }
}

function setupAudioMocks() {
  MockAudioContext.instances = [];
  (globalThis as any).AudioContext = MockAudioContext;
  (globalThis as any).AudioWorkletNode = MockAudioWorkletNode;
}

function makeAudioData(sourceId = 'cam1', sampleRate = 48000, channels = 1) {
  return {
    source_id: sourceId,
    data: new Int16Array([100, 200, 300]).buffer,
    sample_rate: sampleRate,
    channels,
  };
}

describe('AudioPlayer', () => {
  beforeEach(() => {
    resetMockTransport();
    setupAudioMocks();
  });

  afterEach(() => {
    resetMockTransport();
  });

  it('renders a hidden element', () => {
    const { container } = render(AudioPlayer, { props: { sourceId: 'cam1' } });
    const hidden = container.querySelector('.hidden');
    expect(hidden).toBeInTheDocument();
  });

  it('subscribes to audio-data events', () => {
    render(AudioPlayer, { props: { sourceId: 'cam1' } });
    expect(getTransport().hasListeners('audio-data')).toBe(true);
  });

  it('creates AudioContext on first audio data', async () => {
    render(AudioPlayer, { props: { sourceId: 'cam1' } });
    const transport = getTransport();

    transport.emit('audio-data', makeAudioData());
    await tick();
    // Allow async ensureWorklet to complete
    await new Promise((r) => setTimeout(r, 10));

    expect(MockAudioContext.instances.length).toBe(1);
  });

  it('creates AudioContext with correct sample rate', async () => {
    render(AudioPlayer, { props: { sourceId: 'cam1' } });
    const transport = getTransport();

    transport.emit('audio-data', makeAudioData('cam1', 16000));
    await tick();
    await new Promise((r) => setTimeout(r, 10));

    expect(MockAudioContext.instances[0].sampleRate).toBe(16000);
  });

  it('loads worklet module', async () => {
    render(AudioPlayer, { props: { sourceId: 'cam1' } });
    const transport = getTransport();

    transport.emit('audio-data', makeAudioData());
    await tick();
    await new Promise((r) => setTimeout(r, 10));

    const ctx = MockAudioContext.instances[0];
    expect(ctx.audioWorklet.addModule).toHaveBeenCalledWith('/pcm-worklet-processor.js');
  });

  it('ignores events for other source IDs', async () => {
    render(AudioPlayer, { props: { sourceId: 'cam1' } });
    const transport = getTransport();

    transport.emit('audio-data', makeAudioData('cam2'));
    await tick();
    await new Promise((r) => setTimeout(r, 10));

    expect(MockAudioContext.instances.length).toBe(0);
  });

  it('cleans up AudioContext on unmount', async () => {
    const { unmount } = render(AudioPlayer, { props: { sourceId: 'cam1' } });
    const transport = getTransport();

    transport.emit('audio-data', makeAudioData());
    await tick();
    await new Promise((r) => setTimeout(r, 10));

    unmount();

    expect(MockAudioContext.instances[0].closed).toBe(true);
  });

  it('does not create multiple AudioContexts for rapid events', async () => {
    render(AudioPlayer, { props: { sourceId: 'cam1' } });
    const transport = getTransport();

    // Fire several events rapidly
    transport.emit('audio-data', makeAudioData());
    transport.emit('audio-data', makeAudioData());
    transport.emit('audio-data', makeAudioData());
    await tick();
    await new Promise((r) => setTimeout(r, 50));

    // Should only create one AudioContext
    expect(MockAudioContext.instances.length).toBe(1);
  });

  it('handles worklet initialization failure gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Replace AudioContext with a version whose addModule rejects
    const OrigAudioContext = (globalThis as any).AudioContext;
    (globalThis as any).AudioContext = class {
      sampleRate: number;
      audioWorklet = {
        addModule: vi.fn().mockRejectedValue(new Error('load failed')),
      };
      destination = {};
      constructor(options?: any) { this.sampleRate = options?.sampleRate ?? 48000; }
      close() { return Promise.resolve(); }
    };

    render(AudioPlayer, { props: { sourceId: 'cam1' } });
    const transport = getTransport();

    transport.emit('audio-data', makeAudioData());
    await tick();
    await new Promise((r) => setTimeout(r, 50));

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();

    // Restore
    (globalThis as any).AudioContext = OrigAudioContext;
  });
});
