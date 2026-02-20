import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers';

test.beforeEach(async ({ page }) => {
	await setupMocks(page);
	await page.goto('/');
});

test.describe('App loads', () => {
	test('shows header with KODAMA branding', async ({ page }) => {
		await expect(page.getByText('KODAMA')).toBeVisible();
	});

	test('defaults to live view with empty state', async ({ page }) => {
		await expect(page.getByText('Waiting for feeds')).toBeVisible();
	});

	test('shows 0 online in header', async ({ page }) => {
		const header = page.getByRole('banner');
		await expect(header.getByText('0', { exact: true })).toBeVisible();
		await expect(header.getByText('online')).toBeVisible();
	});
});

test.describe('View toggling', () => {
	test('can switch between live and map views', async ({ page }) => {
		// Default is live — empty state visible
		await expect(page.getByText('Waiting for feeds')).toBeVisible();

		// Switch to map
		await page.getByRole('button', { name: /MAP/ }).click();
		await expect(page.getByText('Waiting for feeds')).not.toBeVisible();

		// Switch back to live
		await page.getByRole('button', { name: /LIVE/ }).click();
		await expect(page.getByText('Waiting for feeds')).toBeVisible();
	});
});

test.describe('Settings dialog', () => {
	test('opens and shows theme options', async ({ page }) => {
		await page.locator('header').getByRole('button').last().click();

		await expect(page.getByText('Settings')).toBeVisible();
		await expect(page.getByRole('button', { name: /light/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /dark/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /system/i })).toBeVisible();
	});

	test('shows server status section', async ({ page }) => {
		await page.locator('header').getByRole('button').last().click();

		await expect(page.getByRole('heading', { name: 'Server Status' })).toBeVisible();
	});

	test('shows connection status', async ({ page }) => {
		await page.locator('header').getByRole('button').last().click();

		await expect(page.getByRole('heading', { name: 'Connection' })).toBeVisible();
		// WebSocket mock accepts the upgrade, so transport reports connected
		await expect(page.getByText('Connected', { exact: true })).toBeVisible();
	});
});

test.describe('Header state', () => {
	test('grid layout toggle visible in live view, marker toggle in map view', async ({ page }) => {
		const header = page.getByRole('banner');
		const toggleButtons = header.locator('button[aria-pressed]');

		// Live view: view toggle (2) + grid layout (2) = 4 toggle buttons
		await expect(toggleButtons).toHaveCount(4);

		// Switch to map: view toggle (2) + marker mode (3) = 5 toggle buttons
		await page.getByRole('button', { name: /MAP/ }).click();
		await expect(toggleButtons).toHaveCount(5);
	});
});
