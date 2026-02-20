import type { GridLayout, MarkerMode, ViewMode } from '$lib/types.js';

class SettingsStore {
	theme = $state<'light' | 'dark' | 'system'>('system');
	gridLayout = $state<GridLayout>('auto');
	markerMode = $state<MarkerMode>('detailed');
	sidebarOpen = $state(true);
	currentView = $state<ViewMode>('live');
	/** Camera ID for the single-camera fullscreen view */
	focusedCameraId = $state<string | null>(null);
	/** Show debug stats overlay on camera cards */
	debugMode = $state(false);

	constructor() {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('kodama-theme');
			if (saved === 'light' || saved === 'dark') {
				this.theme = saved;
			}
			const savedGrid = localStorage.getItem('kodama-grid');
			if (savedGrid === 'auto' || savedGrid === '1+5') {
				this.gridLayout = savedGrid;
			}
		}
	}

	setTheme(theme: 'light' | 'dark' | 'system') {
		this.theme = theme;
		if (typeof window !== 'undefined') {
			localStorage.setItem('kodama-theme', theme);
			this.applyTheme();
		}
	}

	applyTheme() {
		if (typeof window === 'undefined') return;
		const root = document.documentElement;
		if (this.theme === 'dark') {
			root.classList.add('dark');
		} else if (this.theme === 'light') {
			root.classList.remove('dark');
		} else {
			// system
			if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
				root.classList.add('dark');
			} else {
				root.classList.remove('dark');
			}
		}
	}

	setGridLayout(layout: GridLayout) {
		this.gridLayout = layout;
		if (typeof window !== 'undefined') {
			localStorage.setItem('kodama-grid', layout);
		}
	}

	setMarkerMode(mode: MarkerMode) {
		this.markerMode = mode;
	}

	setView(view: ViewMode) {
		this.currentView = view;
		if (view !== 'camera') {
			this.focusedCameraId = null;
		}
	}

	openCameraView(cameraId: string) {
		this.focusedCameraId = cameraId;
		this.currentView = 'camera';
	}

	closeCameraView() {
		this.focusedCameraId = null;
		this.currentView = 'live';
	}

	toggleSidebar() {
		this.sidebarOpen = !this.sidebarOpen;
	}
}

export const settingsStore = new SettingsStore();
