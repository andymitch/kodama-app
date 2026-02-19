import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import CameraCard from '../camera/CameraCard.svelte';
import { cameraStore } from '$lib/stores/cameras.svelte.js';

vi.mock('$lib/transport-ws.js', () => import('$lib/__mocks__/transport-ws.js'));

// Mock browser APIs needed by child components
(globalThis as any).MediaSource = class {
  static isTypeSupported() { return false; }
  readyState = 'closed';
  addEventListener() {}
  removeEventListener() {}
  endOfStream() {}
  addSourceBuffer() { return { addEventListener() {}, removeEventListener() {}, mode: '' }; }
};
(globalThis as any).AudioContext = class {
  audioWorklet = { addModule: () => Promise.resolve() };
  destination = {};
  createGain() { return { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } }; }
  close() { return Promise.resolve(); }
};
(globalThis as any).AudioWorkletNode = class {
  port = { postMessage() {} };
  connect() {}
  disconnect() {}
};

import { resetMockTransport } from '$lib/__mocks__/transport-ws.js';

describe('CameraCard', () => {
  beforeEach(() => {
    resetMockTransport();
    cameraStore.cameras = [];
    cameraStore.selectedId = null;
  });

  afterEach(() => {
    resetMockTransport();
  });

  it('renders camera name', () => {
    render(CameraCard, { props: { sourceId: 'cam1', name: 'Front Door', connected: true } });
    expect(screen.getByText('Front Door')).toBeInTheDocument();
  });

  it('shows "LIVE" badge when connected', () => {
    render(CameraCard, { props: { sourceId: 'cam1', name: 'Cam', connected: true } });
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('shows "OFF" badge when disconnected', () => {
    render(CameraCard, { props: { sourceId: 'cam1', name: 'Cam', connected: false } });
    expect(screen.getByText('OFF')).toBeInTheDocument();
  });

  it('contains a video element (from VideoPlayer)', () => {
    const { container } = render(CameraCard, { props: { sourceId: 'cam1', name: 'Cam', connected: true } });
    expect(container.querySelector('video')).toBeInTheDocument();
  });

  it('renders mute toggle (muted by default)', () => {
    render(CameraCard, { props: { sourceId: 'cam1', name: 'Cam', connected: true } });
    expect(screen.getByText('🔇')).toBeInTheDocument();
  });

  it('shows telemetry overlay when camera has telemetry data', () => {
    cameraStore.cameras = [{ id: 'cam1', name: 'Cam', connected: true, telemetry: {
      source_id: 'cam1', cpu_usage: 45, memory_usage: 62, disk_usage: 30,
      uptime_secs: 3600, load_average: [1, 0.8, 0.6], cpu_temp: null, gps: null, motion_level: null,
    }}];
    render(CameraCard, { props: { sourceId: 'cam1', name: 'Cam', connected: true } });
    expect(screen.getByText(/CPU 45%/)).toBeInTheDocument();
    expect(screen.getByText(/Mem 62%/)).toBeInTheDocument();
  });
});
