<script lang="ts">
	import { transportStore } from '$lib/stores/transport.svelte.js';
	import { settingsStore } from '$lib/stores/settings.svelte.js';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import Header from '$lib/components/layout/Header.svelte';
	import MobileNav from '$lib/components/layout/MobileNav.svelte';
	import SettingsDialog from '$lib/components/layout/SettingsDialog.svelte';
	import LiveView from '$lib/views/LiveView.svelte';
	import MapView from '$lib/views/MapView.svelte';

	let mobileNavOpen = $state(false);
	let settingsOpen = $state(false);

	// Apply theme on mount and when it changes
	$effect(() => {
		settingsStore.applyTheme();
	});

	// Listen for system theme changes
	$effect(() => {
		if (typeof window === 'undefined') return;
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		const handler = () => {
			if (settingsStore.theme === 'system') settingsStore.applyTheme();
		};
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	});

	// Connect transport on mount
	$effect(() => {
		transportStore.connect();
		return () => transportStore.disconnect();
	});
</script>

<div class="flex h-dvh overflow-hidden bg-background">
	<!-- Sidebar (desktop only, hidden <768px) -->
	<Sidebar />

	<!-- Mobile nav sheet -->
	<MobileNav bind:open={mobileNavOpen} />

	<!-- Main content area -->
	<div class="flex flex-1 flex-col min-w-0">
		<Header onMenuClick={() => (mobileNavOpen = true)} onSettingsClick={() => (settingsOpen = true)} />

		<main class="flex-1 overflow-hidden relative">
			<div class="absolute inset-0" class:hidden={settingsStore.currentView !== 'live'}>
				<LiveView />
			</div>
			<div class="absolute inset-0" class:hidden={settingsStore.currentView !== 'map'}>
				<MapView />
			</div>
		</main>
	</div>
</div>

<SettingsDialog bind:open={settingsOpen} />
