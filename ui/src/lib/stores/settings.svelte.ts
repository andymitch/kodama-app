import type { GridLayout, MarkerMode, ViewMode } from '$lib/types.js';

class SettingsStore {
	theme = $state<'light' | 'dark' | 'system'>('system');
	gridLayout = $state<GridLayout>('auto');
	markerMode = $state<MarkerMode>('detailed');
	sidebarOpen = $state(true);
	currentView = $state<ViewMode>('live');

	constructor() {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('kodama-theme');
			if (saved === 'light' || saved === 'dark') {
				this.theme = saved;
			}
			const savedGrid = localStorage.getItem('kodama-grid');
			if (savedGrid === 'auto' || savedGrid === '2x2' || savedGrid === '1+5') {
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

	setView(view: ViewMode) {
		this.currentView = view;
	}

	toggleSidebar() {
		this.sidebarOpen = !this.sidebarOpen;
	}
}

export const settingsStore = new SettingsStore();
