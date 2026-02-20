import { describe, it, expect, beforeEach, vi } from 'vitest';
import { alertsStore } from '../alerts.svelte.js';
import { flushSync } from 'svelte';

describe('alertsStore', () => {
	beforeEach(() => {
		flushSync(() => {
			alertsStore.clearAll();
			alertsStore.enabled = true;
			alertsStore.browserNotifications = false;
			alertsStore.disconnectAlertEnabled = true;
			alertsStore.motionThreshold = 0.6;
		});
	});

	it('starts with no alerts', () => {
		expect(alertsStore.alerts).toHaveLength(0);
		expect(alertsStore.unreadCount).toBe(0);
	});

	it('adds an alert', () => {
		flushSync(() => {
			alertsStore.addAlert('disconnect', 'cam1', 'Front Door', 'Front Door disconnected');
		});
		expect(alertsStore.alerts).toHaveLength(1);
		expect(alertsStore.alerts[0].type).toBe('disconnect');
		expect(alertsStore.alerts[0].cameraId).toBe('cam1');
		expect(alertsStore.alerts[0].cameraName).toBe('Front Door');
		expect(alertsStore.alerts[0].message).toBe('Front Door disconnected');
		expect(alertsStore.alerts[0].read).toBe(false);
	});

	it('prepends new alerts (newest first)', () => {
		flushSync(() => {
			alertsStore.addAlert('disconnect', 'cam1', 'Cam 1', 'Disconnected');
			alertsStore.addAlert('motion', 'cam2', 'Cam 2', 'Motion detected');
		});
		expect(alertsStore.alerts[0].type).toBe('motion');
		expect(alertsStore.alerts[1].type).toBe('disconnect');
	});

	it('tracks unread count', () => {
		flushSync(() => {
			alertsStore.addAlert('disconnect', 'cam1', 'Cam 1', 'Disconnected');
			alertsStore.addAlert('reconnect', 'cam1', 'Cam 1', 'Reconnected');
		});
		expect(alertsStore.unreadCount).toBe(2);

		flushSync(() => {
			alertsStore.markRead(alertsStore.alerts[0].id);
		});
		expect(alertsStore.unreadCount).toBe(1);
	});

	it('marks all read', () => {
		flushSync(() => {
			alertsStore.addAlert('disconnect', 'cam1', 'Cam 1', 'Disconnected');
			alertsStore.addAlert('motion', 'cam2', 'Cam 2', 'Motion');
			alertsStore.markAllRead();
		});
		expect(alertsStore.unreadCount).toBe(0);
	});

	it('clears all alerts', () => {
		flushSync(() => {
			alertsStore.addAlert('disconnect', 'cam1', 'Cam 1', 'Disconnected');
			alertsStore.addAlert('motion', 'cam2', 'Cam 2', 'Motion');
			alertsStore.clearAll();
		});
		expect(alertsStore.alerts).toHaveLength(0);
	});

	it('dismisses a single alert', () => {
		flushSync(() => {
			alertsStore.addAlert('disconnect', 'cam1', 'Cam 1', 'Disconnected');
			alertsStore.addAlert('motion', 'cam2', 'Cam 2', 'Motion');
		});
		const id = alertsStore.alerts[1].id;
		flushSync(() => {
			alertsStore.dismiss(id);
		});
		expect(alertsStore.alerts).toHaveLength(1);
		expect(alertsStore.alerts[0].type).toBe('motion');
	});

	it('does not add alerts when disabled', () => {
		flushSync(() => {
			alertsStore.enabled = false;
			alertsStore.addAlert('disconnect', 'cam1', 'Cam 1', 'Disconnected');
		});
		expect(alertsStore.alerts).toHaveLength(0);
	});

	it('caps alerts at 100', () => {
		flushSync(() => {
			for (let i = 0; i < 110; i++) {
				alertsStore.addAlert('motion', `cam${i}`, `Cam ${i}`, `Motion ${i}`);
			}
		});
		expect(alertsStore.alerts.length).toBeLessThanOrEqual(100);
	});

	it('assigns unique incrementing IDs', () => {
		flushSync(() => {
			alertsStore.addAlert('disconnect', 'cam1', 'Cam 1', 'D1');
			alertsStore.addAlert('reconnect', 'cam1', 'Cam 1', 'R1');
		});
		const ids = alertsStore.alerts.map((a) => a.id);
		expect(ids[0]).not.toBe(ids[1]);
		// Newest first, so first has higher id
		expect(ids[0]).toBeGreaterThan(ids[1]);
	});
});
