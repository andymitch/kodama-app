import type { Page } from '@playwright/test';

/** Intercept WebSocket so the transport connects without a real backend. */
export async function mockWebSocket(page: Page) {
	await page.routeWebSocket('**/ws', () => {
		// Accept the upgrade but don't forward to a real server.
		// The page sees a connected WebSocket that simply never sends data.
	});
}

/** Mock REST API endpoints with realistic empty-state responses. */
export async function mockApi(page: Page) {
	await page.route('**/api/cameras', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
	);

	await page.route('**/api/status', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				public_key: 'mock-public-key-abc123',
				cameras: 0,
				clients: 1,
				uptime_secs: 120,
				frames_received: 0,
				frames_broadcast: 0,
			}),
		}),
	);
}

/** Apply all mocks needed for a baseline page load. */
export async function setupMocks(page: Page) {
	await mockWebSocket(page);
	await mockApi(page);
}
