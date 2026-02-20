import { getTransport } from '$lib/transport-ws.js';
import type { KodamaTransport } from '$lib/transport.js';
import { cameraStore } from './cameras.svelte.js';
import { cameraConfigStore } from './cameraConfig.svelte.js';
import { alertsStore } from './alerts.svelte.js';

class TransportStore {
	connected = $state(false);
	error = $state<string | null>(null);

	private transport: KodamaTransport;
	private unsubs: (() => void)[] = [];
	/** Track last motion alert per camera to avoid spamming */
	private lastMotionAlert = new Map<string, number>();

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
					const cam = cameraStore.cameras.find((c) => c.id === ev.source_id);
					const name = cameraConfigStore.getDisplayName(ev.source_id, cam?.name ?? ev.source_id);
					const wasPreviouslyConnected = cam?.connected ?? false;

					cameraStore.updateCamera(ev.source_id, ev.connected);

					// Fire disconnect/reconnect alerts
					if (alertsStore.disconnectAlertEnabled) {
						if (!ev.connected && wasPreviouslyConnected) {
							alertsStore.addAlert('disconnect', ev.source_id, name, `${name} disconnected`);
						} else if (ev.connected && !wasPreviouslyConnected && cam) {
							alertsStore.addAlert('reconnect', ev.source_id, name, `${name} reconnected`);
						}
					}
				}),
				this.transport.on('telemetry', (ev) => {
					cameraStore.updateTelemetry(ev);

					// Fire motion alert if threshold exceeded (max once per 30s per camera)
					if (ev.motion_level !== null && ev.motion_level >= alertsStore.motionThreshold) {
						const now = Date.now();
						const last = this.lastMotionAlert.get(ev.source_id) ?? 0;
						if (now - last > 30_000) {
							this.lastMotionAlert.set(ev.source_id, now);
							const cam = cameraStore.cameras.find((c) => c.id === ev.source_id);
							const name = cameraConfigStore.getDisplayName(ev.source_id, cam?.name ?? ev.source_id);
							alertsStore.addAlert('motion', ev.source_id, name, `Motion detected (${(ev.motion_level * 100).toFixed(0)}%)`);
						}
					}
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
