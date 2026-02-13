import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketTransport, getTransport } from '../transport-ws.js';

// ---------- WebSocket mock ----------

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  url: string;
  binaryType = '';
  onopen: ((ev: any) => void) | null = null;
  onerror: ((ev: any) => void) | null = null;
  onclose: ((ev: any) => void) | null = null;
  onmessage: ((ev: any) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  /** Simulate server sending an ArrayBuffer message */
  simulateBinary(buf: ArrayBuffer) {
    this.onmessage?.({ data: buf });
  }

  /** Simulate server sending a text message */
  simulateText(text: string) {
    this.onmessage?.({ data: text });
  }

  /** Simulate successful open */
  simulateOpen() {
    this.onopen?.({});
  }

  /** Simulate close */
  simulateClose() {
    this.onclose?.({});
  }

  /** Simulate error */
  simulateError() {
    this.onerror?.({});
  }
}

// Helper to build a source_id buffer (8 bytes, hex "0102030405060708")
function makeSourceId(): Uint8Array {
  return new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
}

const SOURCE_ID_HEX = '0102030405060708';

// ---------- Tests ----------

describe('WebSocketTransport', () => {
  let origWebSocket: typeof globalThis.WebSocket;

  beforeEach(() => {
    origWebSocket = globalThis.WebSocket;
    (globalThis as any).WebSocket = MockWebSocket;
    MockWebSocket.instances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.WebSocket = origWebSocket;
    vi.useRealTimers();
  });

  // ---- Connection ----

  describe('connect', () => {
    it('creates WebSocket with provided URL', async () => {
      const transport = new WebSocketTransport();
      const promise = transport.connect('ws://test:1234/ws');
      MockWebSocket.instances[0].simulateOpen();
      await promise;
      expect(MockWebSocket.instances[0].url).toBe('ws://test:1234/ws');
    });

    it('sets binaryType to arraybuffer', async () => {
      const transport = new WebSocketTransport();
      const promise = transport.connect('ws://test/ws');
      MockWebSocket.instances[0].simulateOpen();
      await promise;
      expect(MockWebSocket.instances[0].binaryType).toBe('arraybuffer');
    });

    it('resolves and sets connected on open', async () => {
      const transport = new WebSocketTransport();
      expect(transport.connected).toBe(false);
      const promise = transport.connect('ws://test/ws');
      MockWebSocket.instances[0].simulateOpen();
      await promise;
      expect(transport.connected).toBe(true);
    });

    it('rejects on error before connected', async () => {
      const transport = new WebSocketTransport();
      const promise = transport.connect('ws://test/ws');
      MockWebSocket.instances[0].simulateError();
      await expect(promise).rejects.toThrow('WebSocket connection failed');
    });

    it('closes existing WebSocket before creating new one', async () => {
      const transport = new WebSocketTransport();
      const p1 = transport.connect('ws://test/ws');
      const ws1 = MockWebSocket.instances[0];
      ws1.simulateOpen();
      await p1;

      const p2 = transport.connect('ws://test2/ws');
      expect(ws1.closed).toBe(true);
      MockWebSocket.instances[1].simulateOpen();
      await p2;
    });

    it('derives baseUrl from ws URL', async () => {
      const transport = new WebSocketTransport();
      const promise = transport.connect('ws://myhost:3000/ws');
      MockWebSocket.instances[0].simulateOpen();
      await promise;

      // baseUrl should be http://myhost:3000
      // We test this indirectly through the REST methods
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }));
      await transport.listCameras();
      expect(vi.mocked(fetch)).toHaveBeenCalledWith('http://myhost:3000/api/cameras');
      vi.unstubAllGlobals();
    });

    it('throws if no URL and no window', async () => {
      const origWindow = globalThis.window;
      // @ts-ignore
      delete globalThis.window;

      const transport = new WebSocketTransport();
      await expect(transport.connect()).rejects.toThrow('No URL provided');

      globalThis.window = origWindow;
    });
  });

  // ---- Disconnection ----

  describe('disconnect', () => {
    it('closes WebSocket and sets connected to false', async () => {
      const transport = new WebSocketTransport();
      const promise = transport.connect('ws://test/ws');
      MockWebSocket.instances[0].simulateOpen();
      await promise;

      transport.disconnect();
      expect(transport.connected).toBe(false);
      expect(MockWebSocket.instances[0].closed).toBe(true);
    });

    it('prevents reconnection after disconnect', async () => {
      const transport = new WebSocketTransport();
      const promise = transport.connect('ws://test/ws');
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();
      await promise;

      transport.disconnect();
      // onclose was set to null, so even if we call it, no reconnect
      expect(ws.onclose).toBeNull();
    });
  });

  // ---- Event System ----

  describe('on / emit', () => {
    it('registers and fires listeners', async () => {
      const transport = new WebSocketTransport();
      const cb = vi.fn();
      transport.on('camera-event', cb);

      // Simulate a camera-event via binary message
      const json = JSON.stringify([{ id: 'abc', name: 'Cam', connected: true }]);
      const jsonBytes = new TextEncoder().encode(json);
      const buf = new ArrayBuffer(1 + jsonBytes.length);
      new Uint8Array(buf)[0] = 0x01;
      new Uint8Array(buf).set(jsonBytes, 1);

      const promise = transport.connect('ws://test/ws');
      MockWebSocket.instances[0].simulateOpen();
      await promise;

      MockWebSocket.instances[0].simulateBinary(buf);
      expect(cb).toHaveBeenCalledWith({ source_id: 'abc', connected: true });
    });

    it('returns unsubscribe function that removes listener', async () => {
      const transport = new WebSocketTransport();
      const cb = vi.fn();
      const unsub = transport.on('camera-event', cb);

      unsub();

      // Build a camera-event message
      const json = JSON.stringify([{ id: 'x', name: 'C', connected: true }]);
      const jsonBytes = new TextEncoder().encode(json);
      const buf = new ArrayBuffer(1 + jsonBytes.length);
      new Uint8Array(buf)[0] = 0x01;
      new Uint8Array(buf).set(jsonBytes, 1);

      const promise = transport.connect('ws://test/ws');
      MockWebSocket.instances[0].simulateOpen();
      await promise;
      MockWebSocket.instances[0].simulateBinary(buf);

      expect(cb).not.toHaveBeenCalled();
    });

    it('supports multiple listeners for the same event', async () => {
      const transport = new WebSocketTransport();
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      transport.on('audio-level', cb1);
      transport.on('audio-level', cb2);

      const promise = transport.connect('ws://test/ws');
      MockWebSocket.instances[0].simulateOpen();
      await promise;

      // Build audio-level message: 0x05 + 8 source_id + f32
      const buf = new ArrayBuffer(13);
      const view = new DataView(buf);
      view.setUint8(0, 0x05);
      new Uint8Array(buf).set(makeSourceId(), 1);
      view.setFloat32(9, -20.5, true);

      MockWebSocket.instances[0].simulateBinary(buf);
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('isolates events from each other', async () => {
      const transport = new WebSocketTransport();
      const videoCb = vi.fn();
      const audioCb = vi.fn();
      transport.on('video-segment', videoCb);
      transport.on('audio-level', audioCb);

      const promise = transport.connect('ws://test/ws');
      MockWebSocket.instances[0].simulateOpen();
      await promise;

      // Send audio-level only
      const buf = new ArrayBuffer(13);
      const view = new DataView(buf);
      view.setUint8(0, 0x05);
      new Uint8Array(buf).set(makeSourceId(), 1);
      view.setFloat32(9, -10.0, true);
      MockWebSocket.instances[0].simulateBinary(buf);

      expect(audioCb).toHaveBeenCalledTimes(1);
      expect(videoCb).not.toHaveBeenCalled();
    });

    it('catches errors in listeners without breaking others', async () => {
      const transport = new WebSocketTransport();
      const errorCb = vi.fn(() => { throw new Error('listener error'); });
      const normalCb = vi.fn();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      transport.on('audio-level', errorCb);
      transport.on('audio-level', normalCb);

      const promise = transport.connect('ws://test/ws');
      MockWebSocket.instances[0].simulateOpen();
      await promise;

      const buf = new ArrayBuffer(13);
      const view = new DataView(buf);
      view.setUint8(0, 0x05);
      new Uint8Array(buf).set(makeSourceId(), 1);
      view.setFloat32(9, -30.0, true);
      MockWebSocket.instances[0].simulateBinary(buf);

      expect(normalCb).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ---- Binary Parsing ----

  describe('binary parsing', () => {
    async function setupTransport() {
      const transport = new WebSocketTransport();
      const promise = transport.connect('ws://test/ws');
      MockWebSocket.instances[MockWebSocket.instances.length - 1].simulateOpen();
      await promise;
      return transport;
    }

    function getWs() {
      return MockWebSocket.instances[MockWebSocket.instances.length - 1];
    }

    it('parses 0x01 camera list into camera-event emissions', async () => {
      const transport = await setupTransport();
      const cb = vi.fn();
      transport.on('camera-event', cb);

      const cameras = [
        { id: 'cam1', name: 'Front', connected: true },
        { id: 'cam2', name: 'Back', connected: false },
      ];
      const json = JSON.stringify(cameras);
      const jsonBytes = new TextEncoder().encode(json);
      const buf = new ArrayBuffer(1 + jsonBytes.length);
      new Uint8Array(buf)[0] = 0x01;
      new Uint8Array(buf).set(jsonBytes, 1);

      getWs().simulateBinary(buf);

      expect(cb).toHaveBeenCalledTimes(2);
      expect(cb).toHaveBeenNthCalledWith(1, { source_id: 'cam1', connected: true });
      expect(cb).toHaveBeenNthCalledWith(2, { source_id: 'cam2', connected: false });
    });

    it('parses 0x02 video-init correctly', async () => {
      const transport = await setupTransport();
      const cb = vi.fn();
      transport.on('video-init', cb);

      // Build: type(1) + source_id(8) + codec_len(1) + codec + width(2) + height(2) + init_segment
      const codec = 'avc1.42e01e';
      const codecBytes = new TextEncoder().encode(codec);
      const initPayload = new Uint8Array([0xAA, 0xBB, 0xCC]);
      const totalLen = 1 + 8 + 1 + codecBytes.length + 2 + 2 + initPayload.length;
      const buf = new ArrayBuffer(totalLen);
      const arr = new Uint8Array(buf);
      const view = new DataView(buf);

      arr[0] = 0x02;
      arr.set(makeSourceId(), 1);
      view.setUint8(9, codecBytes.length);
      arr.set(codecBytes, 10);
      const offset = 10 + codecBytes.length;
      view.setUint16(offset, 1920, true);
      view.setUint16(offset + 2, 1080, true);
      arr.set(initPayload, offset + 4);

      getWs().simulateBinary(buf);

      expect(cb).toHaveBeenCalledTimes(1);
      const event = cb.mock.calls[0][0];
      expect(event.source_id).toBe(SOURCE_ID_HEX);
      expect(event.codec).toBe('avc1.42e01e');
      expect(event.width).toBe(1920);
      expect(event.height).toBe(1080);
      expect(new Uint8Array(event.init_segment)).toEqual(initPayload);
    });

    it('parses 0x03 video-segment correctly', async () => {
      const transport = await setupTransport();
      const cb = vi.fn();
      transport.on('video-segment', cb);

      const segData = new Uint8Array([0x00, 0x00, 0x01, 0x67, 0x42]);
      const buf = new ArrayBuffer(1 + 8 + segData.length);
      const arr = new Uint8Array(buf);
      arr[0] = 0x03;
      arr.set(makeSourceId(), 1);
      arr.set(segData, 9);

      getWs().simulateBinary(buf);

      expect(cb).toHaveBeenCalledTimes(1);
      const event = cb.mock.calls[0][0];
      expect(event.source_id).toBe(SOURCE_ID_HEX);
      expect(new Uint8Array(event.data)).toEqual(segData);
    });

    it('parses 0x04 telemetry correctly', async () => {
      const transport = await setupTransport();
      const cb = vi.fn();
      transport.on('telemetry', cb);

      const telemetry = { cpu_usage: 42.5, memory_usage: 60.0, disk_usage: 30.0, uptime_secs: 3600, load_average: [1.0, 0.5, 0.3], cpu_temp: null, gps: null, motion_level: null };
      const json = JSON.stringify(telemetry);
      const jsonBytes = new TextEncoder().encode(json);
      const buf = new ArrayBuffer(1 + 8 + jsonBytes.length);
      const arr = new Uint8Array(buf);
      arr[0] = 0x04;
      arr.set(makeSourceId(), 1);
      arr.set(jsonBytes, 9);

      getWs().simulateBinary(buf);

      expect(cb).toHaveBeenCalledTimes(1);
      const event = cb.mock.calls[0][0];
      expect(event.source_id).toBe(SOURCE_ID_HEX);
      expect(event.cpu_usage).toBe(42.5);
      expect(event.memory_usage).toBe(60.0);
    });

    it('parses 0x05 audio-level correctly', async () => {
      const transport = await setupTransport();
      const cb = vi.fn();
      transport.on('audio-level', cb);

      const buf = new ArrayBuffer(13);
      const view = new DataView(buf);
      const arr = new Uint8Array(buf);
      arr[0] = 0x05;
      arr.set(makeSourceId(), 1);
      view.setFloat32(9, -23.5, true);

      getWs().simulateBinary(buf);

      expect(cb).toHaveBeenCalledTimes(1);
      const event = cb.mock.calls[0][0];
      expect(event.source_id).toBe(SOURCE_ID_HEX);
      expect(event.level_db).toBeCloseTo(-23.5, 1);
    });

    it('parses 0x06 audio-data correctly', async () => {
      const transport = await setupTransport();
      const cb = vi.fn();
      transport.on('audio-data', cb);

      const pcm = new Int16Array([100, -200, 300, -400]);
      const buf = new ArrayBuffer(1 + 8 + 4 + 1 + pcm.byteLength);
      const view = new DataView(buf);
      const arr = new Uint8Array(buf);
      arr[0] = 0x06;
      arr.set(makeSourceId(), 1);
      view.setUint32(9, 48000, true);
      view.setUint8(13, 2); // stereo
      arr.set(new Uint8Array(pcm.buffer), 14);

      getWs().simulateBinary(buf);

      expect(cb).toHaveBeenCalledTimes(1);
      const event = cb.mock.calls[0][0];
      expect(event.source_id).toBe(SOURCE_ID_HEX);
      expect(event.sample_rate).toBe(48000);
      expect(event.channels).toBe(2);
      expect(event.data.byteLength).toBe(pcm.byteLength);
    });

    it('ignores empty messages', async () => {
      const transport = await setupTransport();
      const cb = vi.fn();
      transport.on('camera-event', cb);

      getWs().simulateBinary(new ArrayBuffer(0));
      expect(cb).not.toHaveBeenCalled();
    });

    it('ignores unknown message types', async () => {
      const transport = await setupTransport();
      const cb = vi.fn();
      transport.on('camera-event', cb);
      transport.on('video-init', cb);

      const buf = new ArrayBuffer(10);
      new Uint8Array(buf)[0] = 0xFF; // unknown type
      getWs().simulateBinary(buf);

      expect(cb).not.toHaveBeenCalled();
    });

    it('ignores too-short video-init messages', async () => {
      const transport = await setupTransport();
      const cb = vi.fn();
      transport.on('video-init', cb);

      const buf = new ArrayBuffer(5); // < 14 minimum
      new Uint8Array(buf)[0] = 0x02;
      getWs().simulateBinary(buf);

      expect(cb).not.toHaveBeenCalled();
    });

    it('ignores too-short audio-level messages', async () => {
      const transport = await setupTransport();
      const cb = vi.fn();
      transport.on('audio-level', cb);

      const buf = new ArrayBuffer(5); // < 13 minimum
      new Uint8Array(buf)[0] = 0x05;
      getWs().simulateBinary(buf);

      expect(cb).not.toHaveBeenCalled();
    });
  });

  // ---- Text Messages ----

  describe('text message handling', () => {
    it('handles JSON text messages with type and payload', async () => {
      const transport = new WebSocketTransport();
      const cb = vi.fn();
      transport.on('camera-event', cb);

      const promise = transport.connect('ws://test/ws');
      MockWebSocket.instances[0].simulateOpen();
      await promise;

      MockWebSocket.instances[0].simulateText(JSON.stringify({
        type: 'camera-event',
        payload: { source_id: 'test', connected: true },
      }));

      expect(cb).toHaveBeenCalledWith({ source_id: 'test', connected: true });
    });

    it('ignores malformed JSON text', async () => {
      const transport = new WebSocketTransport();
      const promise = transport.connect('ws://test/ws');
      MockWebSocket.instances[0].simulateOpen();
      await promise;

      // Should not throw
      MockWebSocket.instances[0].simulateText('not json');
      MockWebSocket.instances[0].simulateText('{}');
    });
  });

  // ---- Reconnection ----

  describe('reconnection', () => {
    it('schedules reconnect on close', async () => {
      const transport = new WebSocketTransport();
      const promise = transport.connect('ws://test/ws');
      MockWebSocket.instances[0].simulateOpen();
      await promise;

      MockWebSocket.instances[0].simulateClose();
      expect(transport.connected).toBe(false);

      // Advance timer to trigger reconnect
      vi.advanceTimersByTime(1000);
      // A new WebSocket should have been created
      expect(MockWebSocket.instances.length).toBe(2);
    });

    it('continues reconnecting after repeated failures', async () => {
      const transport = new WebSocketTransport();
      const promise = transport.connect('ws://test/ws');
      MockWebSocket.instances[0].simulateOpen();
      await promise;

      // Close first connection -> schedules reconnect
      MockWebSocket.instances[0].simulateClose();

      // Advance enough to trigger reconnect
      await vi.advanceTimersByTimeAsync(1000);
      expect(MockWebSocket.instances.length).toBe(2);

      // Second connection also closes -> another reconnect scheduled
      MockWebSocket.instances[1].simulateClose();
      await vi.advanceTimersByTimeAsync(2000);
      expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(3);

      // Third connection also closes -> still reconnects
      const lastIdx = MockWebSocket.instances.length - 1;
      MockWebSocket.instances[lastIdx].simulateClose();
      await vi.advanceTimersByTimeAsync(16000); // max backoff
      expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(4);
    });

    it('caps backoff at 16 seconds', async () => {
      const transport = new WebSocketTransport();
      const promise = transport.connect('ws://test/ws');
      MockWebSocket.instances[0].simulateOpen();
      await promise;

      // Simulate many failures to exceed cap
      for (let i = 0; i < 10; i++) {
        const lastIdx = MockWebSocket.instances.length - 1;
        MockWebSocket.instances[lastIdx].simulateClose();
        vi.advanceTimersByTime(16000);
      }

      // Should still be creating new connections (not hanging forever)
      expect(MockWebSocket.instances.length).toBeGreaterThan(5);
    });

    it('does not reconnect after explicit disconnect', async () => {
      const transport = new WebSocketTransport();
      const promise = transport.connect('ws://test/ws');
      MockWebSocket.instances[0].simulateOpen();
      await promise;

      transport.disconnect();
      vi.advanceTimersByTime(30000);

      // Only 1 WebSocket should have been created
      expect(MockWebSocket.instances.length).toBe(1);
    });
  });

  // ---- REST API ----

  describe('REST API', () => {
    it('listCameras calls GET /api/cameras', async () => {
      const transport = new WebSocketTransport();
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ id: 'cam1', name: 'Cam', connected: true }]),
      });
      vi.stubGlobal('fetch', mockFetch);

      const promise = transport.connect('ws://host:3000/ws');
      MockWebSocket.instances[0].simulateOpen();
      await promise;

      const cameras = await transport.listCameras();
      expect(mockFetch).toHaveBeenCalledWith('http://host:3000/api/cameras');
      expect(cameras).toEqual([{ id: 'cam1', name: 'Cam', connected: true }]);

      vi.unstubAllGlobals();
    });

    it('getStatus calls GET /api/status', async () => {
      const transport = new WebSocketTransport();
      const status = { cameras: 2, clients: 1, uptime_secs: 100, frames_received: 500, frames_broadcast: 450 };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(status),
      });
      vi.stubGlobal('fetch', mockFetch);

      const promise = transport.connect('ws://host:3000/ws');
      MockWebSocket.instances[0].simulateOpen();
      await promise;

      const result = await transport.getStatus();
      expect(mockFetch).toHaveBeenCalledWith('http://host:3000/api/status');
      expect(result).toEqual(status);

      vi.unstubAllGlobals();
    });

    it('listCameras throws on non-OK response', async () => {
      const transport = new WebSocketTransport();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

      const promise = transport.connect('ws://host:3000/ws');
      MockWebSocket.instances[0].simulateOpen();
      await promise;

      await expect(transport.listCameras()).rejects.toThrow('Failed to list cameras: 500');
      vi.unstubAllGlobals();
    });

    it('getStatus throws on non-OK response', async () => {
      const transport = new WebSocketTransport();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

      const promise = transport.connect('ws://host:3000/ws');
      MockWebSocket.instances[0].simulateOpen();
      await promise;

      await expect(transport.getStatus()).rejects.toThrow('Failed to get status: 404');
      vi.unstubAllGlobals();
    });
  });

  // ---- Singleton ----

  describe('getTransport', () => {
    it('returns the same instance on repeated calls', () => {
      const t1 = getTransport();
      const t2 = getTransport();
      expect(t1).toBe(t2);
    });
  });

  // ---- Source ID Decoding ----

  describe('source ID decoding', () => {
    it('decodes 8 bytes to 16-char hex string', async () => {
      const transport = await (async () => {
        const t = new WebSocketTransport();
        const p = t.connect('ws://test/ws');
        MockWebSocket.instances[MockWebSocket.instances.length - 1].simulateOpen();
        await p;
        return t;
      })();

      const cb = vi.fn();
      transport.on('audio-level', cb);

      const buf = new ArrayBuffer(13);
      const arr = new Uint8Array(buf);
      arr[0] = 0x05;
      // source_id: 0xDE 0xAD 0xBE 0xEF 0xCA 0xFE 0xBA 0xBE
      arr.set([0xDE, 0xAD, 0xBE, 0xEF, 0xCA, 0xFE, 0xBA, 0xBE], 1);
      new DataView(buf).setFloat32(9, -10, true);

      MockWebSocket.instances[MockWebSocket.instances.length - 1].simulateBinary(buf);

      expect(cb.mock.calls[0][0].source_id).toBe('deadbeefcafebabe');
    });

    it('pads single-digit hex values with leading zero', async () => {
      const transport = await (async () => {
        const t = new WebSocketTransport();
        const p = t.connect('ws://test/ws');
        MockWebSocket.instances[MockWebSocket.instances.length - 1].simulateOpen();
        await p;
        return t;
      })();

      const cb = vi.fn();
      transport.on('audio-level', cb);

      const buf = new ArrayBuffer(13);
      const arr = new Uint8Array(buf);
      arr[0] = 0x05;
      arr.set([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07], 1);
      new DataView(buf).setFloat32(9, -5, true);

      MockWebSocket.instances[MockWebSocket.instances.length - 1].simulateBinary(buf);

      expect(cb.mock.calls[0][0].source_id).toBe('0001020304050607');
    });
  });
});
