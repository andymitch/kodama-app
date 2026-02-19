import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import Dashboard from '../Dashboard.svelte';

vi.mock('$lib/transport-ws.js', () => import('$lib/__mocks__/transport-ws.js'));

// Mock browser APIs needed by nested components
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

import { getTransport, resetMockTransport } from '$lib/__mocks__/transport-ws.js';

describe('Dashboard', () => {
  beforeEach(() => {
    resetMockTransport();
  });

  afterEach(() => {
    resetMockTransport();
  });

  it('renders Dashboard heading', () => {
    render(Dashboard);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('shows Disconnected badge initially', () => {
    render(Dashboard);
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('shows connecting message initially', () => {
    render(Dashboard);
    expect(screen.getByText('Connecting to server...')).toBeInTheDocument();
  });

  it('calls transport.connect() on mount', async () => {
    render(Dashboard);
    await tick();

    const transport = getTransport();
    expect(transport.connectCalls.length).toBe(1);
  });

  it('shows Connected badge after successful connection', async () => {
    render(Dashboard);
    await tick();
    // connect() resolves immediately in mock
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  it('fetches camera list after connecting', async () => {
    const transport = getTransport();
    transport.mockCameras = [
      { id: 'cam1', name: 'Front', connected: true },
      { id: 'cam2', name: 'Back', connected: true },
    ];

    render(Dashboard);
    await tick();
    await waitFor(() => {
      expect(screen.getByText('Front')).toBeInTheDocument();
      expect(screen.getByText('Back')).toBeInTheDocument();
    });
  });

  it('adds camera on camera-event (connected)', async () => {
    render(Dashboard);
    await tick();
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    const transport = getTransport();
    transport.emit('camera-event', { source_id: 'newcam1', connected: true });
    await tick();

    expect(screen.getByText('Camera newcam1')).toBeInTheDocument();
  });

  it('removes camera on camera-event (disconnected)', async () => {
    const transport = getTransport();
    transport.mockCameras = [
      { id: 'cam1', name: 'Front', connected: true },
    ];

    render(Dashboard);
    await tick();
    await waitFor(() => {
      expect(screen.getByText('Front')).toBeInTheDocument();
    });

    transport.emit('camera-event', { source_id: 'cam1', connected: false });
    await tick();

    expect(screen.queryByText('Front')).not.toBeInTheDocument();
  });

  it('does not add duplicate cameras', async () => {
    render(Dashboard);
    await tick();
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    const transport = getTransport();
    transport.emit('camera-event', { source_id: 'cam1', connected: true });
    transport.emit('camera-event', { source_id: 'cam1', connected: true });
    await tick();

    const cards = screen.getAllByText(/Camera cam1/);
    expect(cards.length).toBe(1);
  });

  it('shows no-cameras message when connected but empty', async () => {
    render(Dashboard);
    await tick();
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    expect(screen.getByText(/No cameras connected/)).toBeInTheDocument();
  });

  it('subscribes to camera-event transport events', async () => {
    render(Dashboard);
    await tick();

    const transport = getTransport();
    expect(transport.hasListeners('camera-event')).toBe(true);
  });
});
