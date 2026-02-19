<script lang="ts">
	import { settingsStore } from '$lib/stores/settings.svelte.js';
	import { cameraStore } from '$lib/stores/cameras.svelte.js';
	import { transportStore } from '$lib/stores/transport.svelte.js';
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Map, Video, LayoutGrid, LayoutDashboard, Menu, Settings, MapPin, Tag, MonitorPlay } from 'lucide-svelte';

	let {
		onMenuClick,
		onSettingsClick,
	}: {
		onMenuClick?: () => void;
		onSettingsClick?: () => void;
	} = $props();

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
				(v) => settingsStore.setGridLayout(v as 'auto' | '1+5')
			} class="hidden lg:inline-flex">
				<ToggleGroupItem value="auto">
					<LayoutGrid class="h-3.5 w-3.5" />
				</ToggleGroupItem>
				<ToggleGroupItem value="1+5">
					<LayoutDashboard class="h-3.5 w-3.5" />
				</ToggleGroupItem>
			</ToggleGroup>
		{:else if currentView === 'map'}
			<ToggleGroup bind:value={
				() => settingsStore.markerMode,
				(v) => settingsStore.setMarkerMode(v as 'dot' | 'detailed' | 'pip')
			} class="hidden lg:inline-flex">
				<ToggleGroupItem value="dot">
					<MapPin class="h-3.5 w-3.5" />
				</ToggleGroupItem>
				<ToggleGroupItem value="detailed">
					<Tag class="h-3.5 w-3.5" />
				</ToggleGroupItem>
				<ToggleGroupItem value="pip">
					<MonitorPlay class="h-3.5 w-3.5" />
				</ToggleGroupItem>
			</ToggleGroup>
		{/if}

		<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
			<span class={transportStore.connected ? 'text-primary' : 'text-destructive'}>
				{cameraStore.onlineCount}
			</span>
			<span>online</span>
		</div>

		<Button variant="ghost" size="icon" onclick={onSettingsClick}>
			<Settings class="h-4 w-4" />
		</Button>
	</div>
</header>
