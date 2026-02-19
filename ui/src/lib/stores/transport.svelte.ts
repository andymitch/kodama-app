import { getTransport } from '$lib/transport-ws.js';
import type { KodamaTransport } from '$lib/transport.js';
import { cameraStore } from './cameras.svelte.js';

class TransportStore {
	connected = $state(false);
	error = $state<string | null>(null);

	private transport: KodamaTransport;
	private unsubs: (() => void)[] = [];

	constructor() {
		this.transport = getTransport();
	}

	async connect() {
		this.error = null;
		try {
			await this.transport.connect();
			this.connected = true;

			// Wire up event routing to stores
			this.unsubs.push(
				this.transport.on('camera-event', (ev) => {
					cameraStore.updateCamera(ev.source_id, ev.connected);
				}),
				this.transport.on('telemetry', (ev) => {
					cameraStore.updateTelemetry(ev);
				})
			);

			// Fetch initial camera list
			const cameras = await this.transport.listCameras();
			cameraStore.setCameras(cameras);
		} catch (e) {
			this.connected = false;
			this.error = e instanceof Error ? e.message : 'Connection failed';
		}
	}

	disconnect() {
		for (const unsub of this.unsubs) unsub();
		this.unsubs = [];
		this.transport.disconnect();
		this.connected = false;
	}

	getTransport() {
		return this.transport;
	}
}

export const transportStore = new TransportStore();
