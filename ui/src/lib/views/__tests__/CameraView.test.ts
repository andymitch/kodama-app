import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import CameraView from '../CameraView.svelte';
import { cameraStore } from '$lib/stores/cameras.svelte.js';
import { settingsStore } from '$lib/stores/settings.svelte.js';

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

describe('CameraView', () => {
  beforeEach(() => {
    resetMockTransport();
    cameraStore.cameras = [
      {
        id: 'cam1', name: 'Front Door', connected: true,
        telemetry: {
          source_id: 'cam1', cpu_usage: 45, memory_usage: 62, disk_usage: 30,
          uptime_secs: 3600, load_average: [1, 0.8, 0.6], cpu_temp: 55, gps: null, motion_level: null,
        },
      },
      { id: 'cam2', name: 'Back Yard', connected: false },
    ];
    settingsStore.focusedCameraId = 'cam1';
    settingsStore.currentView = 'camera' as any;
  });

  afterEach(() => {
    resetMockTransport();
    cameraStore.cameras = [];
    cameraStore.selectedId = null;
    settingsStore.focusedCameraId = null;
    settingsStore.currentView = 'live' as any;
  });

  it('renders camera name and LIVE badge', async () => {
    render(CameraView);
    await tick();
    expect(screen.getByText('Front Door')).toBeInTheDocument();
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('shows OFF badge for disconnected camera', async () => {
    settingsStore.focusedCameraId = 'cam2';
    render(CameraView);
    await tick();
    expect(screen.getByText('Back Yard')).toBeInTheDocument();
    expect(screen.getByText('OFF')).toBeInTheDocument();
  });

  it('contains a video element', async () => {
    const { container } = render(CameraView);
    await tick();
    expect(container.querySelector('video')).toBeInTheDocument();
  });

  it('shows telemetry overlay when available', async () => {
    render(CameraView);
    await tick();
    expect(screen.getByText(/CPU 45.0%/)).toBeInTheDocument();
    expect(screen.getByText(/MEM 62.0%/)).toBeInTheDocument();
    expect(screen.getByText(/55°C/)).toBeInTheDocument();
  });

  it('shows keyboard shortcut hints', async () => {
    render(CameraView);
    await tick();
    expect(screen.getByText(/fullscreen/i)).toBeInTheDocument();
    expect(screen.getByText(/mute/i)).toBeInTheDocument();
    expect(screen.getByText(/back/i)).toBeInTheDocument();
  });

  it('shows "Camera not found" when no camera matches', async () => {
    settingsStore.focusedCameraId = 'nonexistent';
    render(CameraView);
    await tick();
    expect(screen.getByText('Camera not found')).toBeInTheDocument();
  });

  it('shows "Camera not found" when focusedCameraId is null', async () => {
    settingsStore.focusedCameraId = null;
    render(CameraView);
    await tick();
    expect(screen.getByText('Camera not found')).toBeInTheDocument();
  });

  it('renders uptime in telemetry overlay', async () => {
    render(CameraView);
    await tick();
    expect(screen.getByText(/Up 1h 0m/)).toBeInTheDocument();
  });
});

describe('settingsStore camera view', () => {
  afterEach(() => {
    settingsStore.focusedCameraId = null;
    settingsStore.currentView = 'live' as any;
  });

  it('openCameraView sets view and camera id', () => {
    settingsStore.openCameraView('cam1');
    expect(settingsStore.currentView).toBe('camera');
    expect(settingsStore.focusedCameraId).toBe('cam1');
  });

  it('closeCameraView returns to live view', () => {
    settingsStore.openCameraView('cam1');
    settingsStore.closeCameraView();
    expect(settingsStore.currentView).toBe('live');
    expect(settingsStore.focusedCameraId).toBeNull();
  });

  it('setView to non-camera clears focusedCameraId', () => {
    settingsStore.openCameraView('cam1');
    settingsStore.setView('map');
    expect(settingsStore.focusedCameraId).toBeNull();
  });
});
