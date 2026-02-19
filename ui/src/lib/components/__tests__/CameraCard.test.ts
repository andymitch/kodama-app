import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import CameraCard from '../CameraCard.svelte';

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
  });

  afterEach(() => {
    resetMockTransport();
  });

  it('renders camera name', () => {
    render(CameraCard, { props: { sourceId: 'cam1', name: 'Front Door', connected: true } });
    expect(screen.getByText('Front Door')).toBeInTheDocument();
  });

  it('shows "Live" badge when connected', () => {
    render(CameraCard, { props: { sourceId: 'cam1', name: 'Cam', connected: true } });
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('shows "Offline" badge when disconnected', () => {
    render(CameraCard, { props: { sourceId: 'cam1', name: 'Cam', connected: false } });
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('contains a video element (from VideoPlayer)', () => {
    const { container } = render(CameraCard, { props: { sourceId: 'cam1', name: 'Cam', connected: true } });
    expect(container.querySelector('video')).toBeInTheDocument();
  });

  it('renders AudioMeter component', () => {
    const { container } = render(CameraCard, { props: { sourceId: 'cam1', name: 'Cam', connected: true } });
    // AudioMeter renders a speaker icon
    expect(screen.getByText('🔊')).toBeInTheDocument();
  });

  it('renders TelemetryPanel waiting state', () => {
    render(CameraCard, { props: { sourceId: 'cam1', name: 'Cam', connected: true } });
    expect(screen.getByText('Waiting for telemetry...')).toBeInTheDocument();
  });
});
