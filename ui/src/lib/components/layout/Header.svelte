<script lang="ts">
	import { settingsStore } from '$lib/stores/settings.svelte.js';
	import { cameraStore } from '$lib/stores/cameras.svelte.js';
	import { transportStore } from '$lib/stores/transport.svelte.js';
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Map, Video, Sun, Moon, Monitor, Grid2x2, LayoutGrid, LayoutDashboard, Menu, Settings } from 'lucide-svelte';
	import SettingsDialog from './SettingsDialog.svelte';

	let {
		onMenuClick,
	}: {
		onMenuClick?: () => void;
	} = $props();

	let settingsOpen = $state(false);

	function cycleTheme() {
		const order: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
		const idx = order.indexOf(settingsStore.theme);
		settingsStore.setTheme(order[(idx + 1) % order.length]);
	}

	let currentView = $derived(settingsStore.currentView);
</script>

<header class="flex items-center justify-between h-12 px-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
	<!-- Left: mobile menu + branding -->
	<div class="flex items-center gap-3">
		<Button variant="ghost" size="icon" class="md:hidden" onclick={onMenuClick}>
			<Menu class="h-5 w-5" />
		</Button>
		<div class="flex items-center gap-2">
			<span class="text-sm font-bold tracking-widest text-primary">KODAMA</span>
		</div>
	</div>

	<!-- Center: view toggle -->
	<div class="flex items-center gap-2">
		<ToggleGroup bind:value={
			() => settingsStore.currentView,
			(v) => settingsStore.setView(v as 'live' | 'map')
		}>
			<ToggleGroupItem value="live">
				<Video class="h-4 w-4 mr-1.5" />
				<span class="hidden sm:inline text-xs">LIVE</span>
			</ToggleGroupItem>
			<ToggleGroupItem value="map">
				<Map class="h-4 w-4 mr-1.5" />
				<span class="hidden sm:inline text-xs">MAP</span>
			</ToggleGroupItem>
		</ToggleGroup>
	</div>

	<!-- Right: grid selector + status + theme -->
	<div class="flex items-center gap-2">
		{#if currentView === 'live'}
			<ToggleGroup bind:value={
				() => settingsStore.gridLayout,
				(v) => settingsStore.setGridLayout(v as 'auto' | '2x2' | '1+5')
			} class="hidden sm:inline-flex">
				<ToggleGroupItem value="auto">
					<LayoutGrid class="h-3.5 w-3.5" />
				</ToggleGroupItem>
				<ToggleGroupItem value="2x2">
					<Grid2x2 class="h-3.5 w-3.5" />
				</ToggleGroupItem>
				<ToggleGroupItem value="1+5">
					<LayoutDashboard class="h-3.5 w-3.5" />
				</ToggleGroupItem>
			</ToggleGroup>
		{/if}

		<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
			<span class={transportStore.connected ? 'text-primary' : 'text-destructive'}>
				{cameraStore.onlineCount}
			</span>
			<span>online</span>
		</div>

		<Button variant="ghost" size="icon" onclick={cycleTheme}>
			{#if settingsStore.theme === 'dark'}
				<Moon class="h-4 w-4" />
			{:else if settingsStore.theme === 'light'}
				<Sun class="h-4 w-4" />
			{:else}
				<Monitor class="h-4 w-4" />
			{/if}
		</Button>

		<Button variant="ghost" size="icon" onclick={() => (settingsOpen = true)}>
			<Settings class="h-4 w-4" />
		</Button>
	</div>
</header>

<SettingsDialog bind:open={settingsOpen} />
