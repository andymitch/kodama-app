import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import App from '../App.svelte';

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

import { resetMockTransport } from '$lib/__mocks__/transport-ws.js';

describe('App', () => {
  beforeEach(() => {
    resetMockTransport();
    window.location.hash = '#/';
  });

  afterEach(() => {
    resetMockTransport();
    window.location.hash = '';
  });

  it('renders header with app name', () => {
    render(App);
    expect(screen.getByText('Kodama')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    const { container } = render(App);
    const navLinks = container.querySelectorAll('nav a');
    const texts = Array.from(navLinks).map(a => a.textContent?.trim());
    expect(texts).toContain('Dashboard');
    expect(texts).toContain('Settings');
  });

  it('shows Dashboard page by default', () => {
    render(App);
    // Dashboard renders "Dashboard" heading and "Disconnected" badge
    const headings = screen.getAllByText('Dashboard');
    // One from nav, one from Dashboard component
    expect(headings.length).toBeGreaterThanOrEqual(2);
  });

  it('shows Settings page when hash is #/settings', () => {
    window.location.hash = '#/settings';
    render(App);
    expect(screen.getByText('Server Status')).toBeInTheDocument();
  });

  it('navigation links have correct hrefs', () => {
    const { container } = render(App);
    const links = container.querySelectorAll('a');
    const hrefs = Array.from(links).map(a => a.getAttribute('href'));
    expect(hrefs).toContain('#/');
    expect(hrefs).toContain('#/settings');
  });
});
