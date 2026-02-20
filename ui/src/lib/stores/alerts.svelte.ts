export type AlertType = 'motion' | 'disconnect' | 'reconnect';

export interface Alert {
	id: number;
	type: AlertType;
	cameraId: string;
	cameraName: string;
	message: string;
	timestamp: number;
	read: boolean;
}

const MAX_ALERTS = 100;

class AlertsStore {
	alerts = $state<Alert[]>([]);
	enabled = $state(true);
	browserNotifications = $state(false);
	motionThreshold = $state(0.6);
	disconnectAlertEnabled = $state(true);

	private nextId = 1;

	unreadCount = $derived(this.alerts.filter((a) => !a.read).length);

	recentAlerts = $derived(this.alerts.slice(0, MAX_ALERTS));

	addAlert(type: AlertType, cameraId: string, cameraName: string, message: string) {
		if (!this.enabled) return;

		const alert: Alert = {
			id: this.nextId++,
			type,
			cameraId,
			cameraName,
			message,
			timestamp: Date.now(),
			read: false,
		};

		// Prepend new alert and cap at MAX_ALERTS
		this.alerts = [alert, ...this.alerts].slice(0, MAX_ALERTS);

		// Browser notification
		if (this.browserNotifications && typeof window !== 'undefined' && 'Notification' in window) {
			if (Notification.permission === 'granted') {
				new Notification(`${cameraName} - ${type}`, { body: message });
			}
		}
	}

	markRead(id: number) {
		const idx = this.alerts.findIndex((a) => a.id === id);
		if (idx >= 0) {
			this.alerts[idx].read = true;
		}
	}

	markAllRead() {
		for (const alert of this.alerts) {
			alert.read = true;
		}
	}

	clearAll() {
		this.alerts = [];
	}

	dismiss(id: number) {
		this.alerts = this.alerts.filter((a) => a.id !== id);
	}
}

export const alertsStore = new AlertsStore();
