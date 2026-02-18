import type { CameraInfo, TelemetryEvent } from '$lib/types.js';

export interface CameraState extends CameraInfo {
	telemetry?: TelemetryEvent;
}

class CameraStore {
	cameras = $state<CameraState[]>([]);
	selectedId = $state<string | null>(null);

	selected = $derived(
		this.selectedId ? this.cameras.find((c) => c.id === this.selectedId) ?? null : null
	);

	onlineCount = $derived(this.cameras.filter((c) => c.connected).length);

	setCameras(list: CameraInfo[]) {
		// Merge with existing telemetry data
		this.cameras = list.map((cam) => {
			const existing = this.cameras.find((c) => c.id === cam.id);
			return { ...cam, telemetry: existing?.telemetry };
		});
	}

	updateCamera(sourceId: string, connected: boolean) {
		const idx = this.cameras.findIndex((c) => c.id === sourceId);
		if (idx >= 0) {
			this.cameras[idx].connected = connected;
		} else {
			this.cameras.push({ id: sourceId, name: sourceId, connected });
		}
	}

	updateTelemetry(event: TelemetryEvent) {
		const idx = this.cameras.findIndex((c) => c.id === event.source_id);
		if (idx >= 0) {
			this.cameras[idx].telemetry = event;
		}
	}

	select(id: string | null) {
		this.selectedId = this.selectedId === id ? null : id;
	}
}

export const cameraStore = new CameraStore();
