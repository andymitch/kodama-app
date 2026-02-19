import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import AudioMeter from '../AudioMeter.svelte';

vi.mock('$lib/transport-ws.js', () => import('$lib/__mocks__/transport-ws.js'));

import { getTransport, resetMockTransport } from '$lib/__mocks__/transport-ws.js';

describe('AudioMeter', () => {
  beforeEach(() => {
    resetMockTransport();
  });

  afterEach(() => {
    resetMockTransport();
  });

  it('renders with initial silent state', () => {
    render(AudioMeter, { props: { sourceId: 'cam1' } });
    expect(screen.getByText('Silent')).toBeInTheDocument();
  });

  it('subscribes to audio-level events on mount', () => {
    render(AudioMeter, { props: { sourceId: 'cam1' } });
    const transport = getTransport();
    expect(transport.hasListeners('audio-level')).toBe(true);
  });

  it('updates level display on audio-level event', async () => {
    render(AudioMeter, { props: { sourceId: 'cam1' } });
    const transport = getTransport();

    transport.emit('audio-level', { source_id: 'cam1', level_db: -20 });
    await tick();

    expect(screen.getByText('-20 dB')).toBeInTheDocument();
  });

  it('shows "Silent" for levels at or below -60 dB', async () => {
    render(AudioMeter, { props: { sourceId: 'cam1' } });
    const transport = getTransport();

    transport.emit('audio-level', { source_id: 'cam1', level_db: -60 });
    await tick();

    expect(screen.getByText('Silent')).toBeInTheDocument();
  });

  it('ignores events for other source IDs', async () => {
    render(AudioMeter, { props: { sourceId: 'cam1' } });
    const transport = getTransport();

    transport.emit('audio-level', { source_id: 'cam2', level_db: -10 });
    await tick();

    // Should still show Silent (initial state)
    expect(screen.getByText('Silent')).toBeInTheDocument();
  });

  it('applies green color for low levels (<= -20 dB)', async () => {
    const { container } = render(AudioMeter, { props: { sourceId: 'cam1' } });
    const transport = getTransport();

    transport.emit('audio-level', { source_id: 'cam1', level_db: -30 });
    await tick();

    const bar = container.querySelector('.bg-green-500');
    expect(bar).toBeInTheDocument();
  });

  it('applies yellow color for medium levels (-20 to -6 dB)', async () => {
    const { container } = render(AudioMeter, { props: { sourceId: 'cam1' } });
    const transport = getTransport();

    transport.emit('audio-level', { source_id: 'cam1', level_db: -10 });
    await tick();

    const bar = container.querySelector('.bg-yellow-500');
    expect(bar).toBeInTheDocument();
  });

  it('applies red color for high levels (> -6 dB)', async () => {
    const { container } = render(AudioMeter, { props: { sourceId: 'cam1' } });
    const transport = getTransport();

    transport.emit('audio-level', { source_id: 'cam1', level_db: -3 });
    await tick();

    const bar = container.querySelector('.bg-red-500');
    expect(bar).toBeInTheDocument();
  });

  it('sets correct bar width percentage', async () => {
    const { container } = render(AudioMeter, { props: { sourceId: 'cam1' } });
    const transport = getTransport();

    // -30 dB -> ((-30 + 60) / 60) * 100 = 50%
    transport.emit('audio-level', { source_id: 'cam1', level_db: -30 });
    await tick();

    const bar = container.querySelector('[style*="width"]') as HTMLElement;
    expect(bar?.style.width).toBe('50%');
  });

  it('clamps bar width to 0-100%', async () => {
    const { container } = render(AudioMeter, { props: { sourceId: 'cam1' } });
    const transport = getTransport();

    // +10 dB -> would be 116.7%, but clamped to 100%
    transport.emit('audio-level', { source_id: 'cam1', level_db: 10 });
    await tick();

    const bar = container.querySelector('[style*="width"]') as HTMLElement;
    expect(bar?.style.width).toBe('100%');
  });
});
