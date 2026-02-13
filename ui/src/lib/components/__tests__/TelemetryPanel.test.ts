import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import TelemetryPanel from '../TelemetryPanel.svelte';
import type { TelemetryEvent } from '$lib/types.js';

vi.mock('$lib/transport-ws.js', () => import('$lib/__mocks__/transport-ws.js'));

import { getTransport, resetMockTransport } from '$lib/__mocks__/transport-ws.js';

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

describe('TelemetryPanel', () => {
  beforeEach(() => {
    resetMockTransport();
  });

  afterEach(() => {
    resetMockTransport();
  });

  it('shows waiting message when no telemetry received', () => {
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    expect(screen.getByText('Waiting for telemetry...')).toBeInTheDocument();
  });

  it('subscribes to telemetry events', () => {
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    expect(getTransport().hasListeners('telemetry')).toBe(true);
  });

  it('renders CPU usage', async () => {
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    getTransport().emit('telemetry', baseTelemetry());
    await tick();

    expect(screen.getByText('CPU')).toBeInTheDocument();
    expect(screen.getByText('45.2%')).toBeInTheDocument();
  });

  it('renders memory usage', async () => {
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    getTransport().emit('telemetry', baseTelemetry());
    await tick();

    expect(screen.getByText('Mem')).toBeInTheDocument();
    expect(screen.getByText('62.8%')).toBeInTheDocument();
  });

  it('renders disk usage', async () => {
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    getTransport().emit('telemetry', baseTelemetry());
    await tick();

    expect(screen.getByText('Disk')).toBeInTheDocument();
    expect(screen.getByText('34.1%')).toBeInTheDocument();
  });

  it('renders load average', async () => {
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    getTransport().emit('telemetry', baseTelemetry());
    await tick();

    expect(screen.getByText('Load')).toBeInTheDocument();
    expect(screen.getByText('1.05 0.82 0.63')).toBeInTheDocument();
  });

  it('renders uptime in hours/minutes format', async () => {
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    getTransport().emit('telemetry', baseTelemetry({ uptime_secs: 7200 }));
    await tick();

    expect(screen.getByText('Up')).toBeInTheDocument();
    expect(screen.getByText('2h 0m')).toBeInTheDocument();
  });

  it('renders uptime in days/hours for > 24h', async () => {
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    getTransport().emit('telemetry', baseTelemetry({ uptime_secs: 100_000 }));
    await tick();

    // 100000s = 27.7h -> 1d 3h
    expect(screen.getByText('1d 3h')).toBeInTheDocument();
  });

  it('renders CPU temperature when available', async () => {
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    getTransport().emit('telemetry', baseTelemetry({ cpu_temp: 55.3 }));
    await tick();

    expect(screen.getByText('Temp')).toBeInTheDocument();
    expect(screen.getByText('55.3°C')).toBeInTheDocument();
  });

  it('hides CPU temperature when null', async () => {
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    getTransport().emit('telemetry', baseTelemetry({ cpu_temp: null }));
    await tick();

    expect(screen.queryByText('Temp')).not.toBeInTheDocument();
  });

  it('renders GPS coordinates when available', async () => {
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    getTransport().emit('telemetry', baseTelemetry({
      gps: { latitude: 37.7749, longitude: -122.4194, altitude: 10, speed: null, heading: null, fix_mode: 3 },
    }));
    await tick();

    expect(screen.getByText('GPS')).toBeInTheDocument();
    expect(screen.getByText('37.77490N 122.41940W')).toBeInTheDocument();
  });

  it('renders speed when GPS speed is available', async () => {
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    getTransport().emit('telemetry', baseTelemetry({
      gps: { latitude: 0, longitude: 0, altitude: null, speed: 10.5, heading: null, fix_mode: 3 },
    }));
    await tick();

    expect(screen.getByText('Speed')).toBeInTheDocument();
    expect(screen.getByText('37.8 km/h')).toBeInTheDocument();
  });

  it('renders altitude when available', async () => {
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    getTransport().emit('telemetry', baseTelemetry({
      gps: { latitude: 0, longitude: 0, altitude: 150.5, speed: null, heading: null, fix_mode: 3 },
    }));
    await tick();

    expect(screen.getByText('Alt')).toBeInTheDocument();
    expect(screen.getByText('150.5m')).toBeInTheDocument();
  });

  it('renders motion level with correct label', async () => {
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });

    getTransport().emit('telemetry', baseTelemetry({ motion_level: 0.05 }));
    await tick();
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('renders motion level "Low" for 0.1-0.3', async () => {
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    getTransport().emit('telemetry', baseTelemetry({ motion_level: 0.2 }));
    await tick();
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('renders motion level "Medium" for 0.3-0.6', async () => {
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    getTransport().emit('telemetry', baseTelemetry({ motion_level: 0.5 }));
    await tick();
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('renders motion level "High" for >= 0.6', async () => {
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    getTransport().emit('telemetry', baseTelemetry({ motion_level: 0.8 }));
    await tick();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('hides motion when null', async () => {
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    getTransport().emit('telemetry', baseTelemetry({ motion_level: null }));
    await tick();
    expect(screen.queryByText('Motion')).not.toBeInTheDocument();
  });

  it('ignores events for other source IDs', async () => {
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });
    getTransport().emit('telemetry', baseTelemetry({ source_id: 'cam2' }));
    await tick();

    expect(screen.getByText('Waiting for telemetry...')).toBeInTheDocument();
  });

  it('updates when new telemetry arrives', async () => {
    render(TelemetryPanel, { props: { sourceId: 'cam1' } });

    getTransport().emit('telemetry', baseTelemetry({ cpu_usage: 10 }));
    await tick();
    expect(screen.getByText('10.0%')).toBeInTheDocument();

    getTransport().emit('telemetry', baseTelemetry({ cpu_usage: 90 }));
    await tick();
    expect(screen.getByText('90.0%')).toBeInTheDocument();
    expect(screen.queryByText('10.0%')).not.toBeInTheDocument();
  });
});
