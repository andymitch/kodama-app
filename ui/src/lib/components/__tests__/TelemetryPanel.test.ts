import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import TelemetryPanel from '../telemetry/TelemetryPanel.svelte';
import { cameraStore } from '$lib/stores/cameras.svelte.js';
import type { TelemetryEvent } from '$lib/types.js';

vi.mock('$lib/transport-ws.js', () => import('$lib/__mocks__/transport-ws.js'));

function baseTelemetry(overrides: Partial<TelemetryEvent> = {}): TelemetryEvent {
  return {
    source_id: 'cam1',
    cpu_usage: 45.2,
    cpu_temp: null,
    memory_usage: 62.8,
    disk_usage: 34.1,
    uptime_secs: 7200,
    load_average: [1.05, 0.82, 0.63],
    gps: null,
    motion_level: null,
    ...overrides,
  };
}

function setupCamera(telemetry?: TelemetryEvent) {
  cameraStore.cameras = [{ id: 'cam1', name: 'Cam 1', connected: true, telemetry }];
}

describe('TelemetryPanel', () => {
  beforeEach(() => {
    cameraStore.cameras = [];
    cameraStore.selectedId = null;
  });

  afterEach(() => {
    cameraStore.cameras = [];
    cameraStore.selectedId = null;
  });

  it('shows waiting message when no telemetry received', () => {
    setupCamera();
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    expect(screen.getByText('Waiting for telemetry...')).toBeInTheDocument();
  });

  it('reads telemetry from cameraStore', async () => {
    const t = baseTelemetry();
    setupCamera(t);
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    await tick();

    expect(screen.getByText('CPU')).toBeInTheDocument();
    expect(screen.getByText('45.2%')).toBeInTheDocument();
  });

  it('renders CPU usage', async () => {
    setupCamera(baseTelemetry());
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    await tick();

    expect(screen.getByText('CPU')).toBeInTheDocument();
    expect(screen.getByText('45.2%')).toBeInTheDocument();
  });

  it('renders memory usage', async () => {
    setupCamera(baseTelemetry());
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    await tick();

    expect(screen.getByText('MEM')).toBeInTheDocument();
    expect(screen.getByText('62.8%')).toBeInTheDocument();
  });

  it('renders disk usage', async () => {
    setupCamera(baseTelemetry());
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    await tick();

    expect(screen.getByText('Disk')).toBeInTheDocument();
    expect(screen.getByText('34.1%')).toBeInTheDocument();
  });

  it('renders load average', async () => {
    setupCamera(baseTelemetry());
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    await tick();

    expect(screen.getByText('Load')).toBeInTheDocument();
    expect(screen.getByText('1.05 0.82 0.63')).toBeInTheDocument();
  });

  it('renders uptime in hours/minutes format', async () => {
    setupCamera(baseTelemetry({ uptime_secs: 7200 }));
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    await tick();

    expect(screen.getByText('Uptime')).toBeInTheDocument();
    expect(screen.getByText('2h 0m')).toBeInTheDocument();
  });

  it('renders uptime in days/hours for > 24h', async () => {
    setupCamera(baseTelemetry({ uptime_secs: 100_000 }));
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    await tick();

    // 100000s = 27.7h -> 1d 3h
    expect(screen.getByText('1d 3h')).toBeInTheDocument();
  });

  it('renders CPU temperature when available', async () => {
    setupCamera(baseTelemetry({ cpu_temp: 55.3 }));
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    await tick();

    expect(screen.getByText('Temp')).toBeInTheDocument();
    expect(screen.getByText('55.3°C')).toBeInTheDocument();
  });

  it('hides CPU temperature when null', async () => {
    setupCamera(baseTelemetry({ cpu_temp: null }));
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    await tick();

    expect(screen.queryByText('Temp')).not.toBeInTheDocument();
  });

  it('renders GPS coordinates when available', async () => {
    setupCamera(baseTelemetry({
      gps: { latitude: 37.7749, longitude: -122.4194, altitude: 10, speed: null, heading: null, fix_mode: 3 },
    }));
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    await tick();

    expect(screen.getByText('GPS')).toBeInTheDocument();
    expect(screen.getByText('37.77490N 122.41940W')).toBeInTheDocument();
  });

  it('renders speed when GPS speed is available', async () => {
    setupCamera(baseTelemetry({
      gps: { latitude: 0, longitude: 0, altitude: null, speed: 10.5, heading: null, fix_mode: 3 },
    }));
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    await tick();

    expect(screen.getByText('Speed')).toBeInTheDocument();
    expect(screen.getByText('37.8 km/h')).toBeInTheDocument();
  });

  it('renders altitude when available', async () => {
    setupCamera(baseTelemetry({
      gps: { latitude: 0, longitude: 0, altitude: 150.5, speed: null, heading: null, fix_mode: 3 },
    }));
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    await tick();

    expect(screen.getByText('Alt')).toBeInTheDocument();
    expect(screen.getByText('150.5m')).toBeInTheDocument();
  });

  it('renders motion level with correct label', async () => {
    setupCamera(baseTelemetry({ motion_level: 0.05 }));
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    await tick();
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('renders motion level "Low" for 0.1-0.3', async () => {
    setupCamera(baseTelemetry({ motion_level: 0.2 }));
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    await tick();
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('renders motion level "Med" for 0.3-0.6', async () => {
    setupCamera(baseTelemetry({ motion_level: 0.5 }));
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    await tick();
    expect(screen.getByText('Med')).toBeInTheDocument();
  });

  it('renders motion level "High" for >= 0.6', async () => {
    setupCamera(baseTelemetry({ motion_level: 0.8 }));
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    await tick();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('hides motion when null', async () => {
    setupCamera(baseTelemetry({ motion_level: null }));
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    await tick();
    expect(screen.queryByText('Motion')).not.toBeInTheDocument();
  });

  it('shows waiting when camera has no telemetry', () => {
    setupCamera(undefined);
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    expect(screen.getByText('Waiting for telemetry...')).toBeInTheDocument();
  });

  it('updates when telemetry changes in store', async () => {
    setupCamera(baseTelemetry({ cpu_usage: 10 }));
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    await tick();
    expect(screen.getByText('10.0%')).toBeInTheDocument();

    cameraStore.updateTelemetry(baseTelemetry({ cpu_usage: 90 }));
    await tick();
    expect(screen.getByText('90.0%')).toBeInTheDocument();
    expect(screen.queryByText('10.0%')).not.toBeInTheDocument();
  });
});
