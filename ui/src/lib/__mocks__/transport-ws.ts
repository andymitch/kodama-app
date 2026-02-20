/**
 * Mock transport for component tests.
 *
 * Components call `getTransport()` to subscribe to events.
 * This mock captures subscriptions and lets tests emit events.
 */
import type { KodamaTransport, TransportEventName, TransportEvents, Unsubscribe } from '../transport.js';
import type { CameraInfo, ServerStatus, VideoInitEvent } from '../types.js';

type Listener<E extends TransportEventName = TransportEventName> = (data: TransportEvents[E]) => void;

export class MockTransport implements KodamaTransport {
  private _connected = false;
  private listeners = new Map<TransportEventName, Set<Listener<any>>>();

  private videoInitCache = new Map<string, VideoInitEvent>();

  connectCalls: string[] = [];
  disconnectCalls = 0;

  mockCameras: CameraInfo[] = [];
  mockStatus: ServerStatus = {
    cameras: 0,
    clients: 0,
    uptime_secs: 0,
    frames_received: 0,
    frames_broadcast: 0,
  };

  get connected(): boolean {
    return this._connected;
  }

  async connect(url?: string): Promise<void> {
    this.connectCalls.push(url ?? 'default');
    this._connected = true;
  }

  disconnect(): void {
    this.disconnectCalls++;
    this._connected = false;
  }

  on<E extends TransportEventName>(event: E, cb: (data: TransportEvents[E]) => void): Unsubscribe {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(cb as Listener<any>);
    return () => set.delete(cb as Listener<any>);
  }

  getVideoInit(sourceId: string): VideoInitEvent | undefined {
    return this.videoInitCache.get(sourceId);
  }

  /** Set a cached video-init for testing segment-triggered recovery */
  setVideoInit(sourceId: string, event: VideoInitEvent): void {
    this.videoInitCache.set(sourceId, event);
  }

  async listCameras(): Promise<CameraInfo[]> {
    return this.mockCameras;
  }

  async getStatus(): Promise<ServerStatus> {
    return this.mockStatus;
  }

  /** Emit an event to all subscribed listeners */
  emit<E extends TransportEventName>(event: E, data: TransportEvents[E]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const cb of set) {
        cb(data);
      }
    }
  }

  /** Check if any listeners are registered for an event */
  hasListeners(event: TransportEventName): boolean {
    return (this.listeners.get(event)?.size ?? 0) > 0;
  }

  reset(): void {
    this.listeners.clear();
    this._connected = false;
    this.connectCalls = [];
    this.disconnectCalls = 0;
    this.mockCameras = [];
    this.videoInitCache.clear();
  }
}

let mockInstance: MockTransport | null = null;

export function getTransport(): MockTransport {
  if (!mockInstance) {
    mockInstance = new MockTransport();
  }
  return mockInstance;
}

export function resetMockTransport(): void {
  if (mockInstance) {
    mockInstance.reset();
  }
  mockInstance = null;
}
