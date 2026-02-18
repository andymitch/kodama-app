<script lang="ts">
	import { onMount } from 'svelte';
	import { cameraStore } from '$lib/stores/cameras.svelte.js';
	import { settingsStore } from '$lib/stores/settings.svelte.js';
	import CameraMarker from './CameraMarker.svelte';
	import type L from 'leaflet';

	let mapEl: HTMLDivElement;
	let map = $state<L.Map | null>(null);
	let leaflet = $state<typeof L>(undefined as unknown as typeof L);

	const CARTODB_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
	const CARTODB_LIGHT_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
	const SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

	let tileLayer: L.TileLayer | null = null;
	let useSatellite = $state(false);

	// Cameras with GPS data
	let geoLocatedCameras = $derived(
		cameraStore.cameras.filter(
			(c) => c.telemetry?.gps && c.telemetry.gps.latitude !== 0
		)
	);

	onMount(async () => {
		leaflet = (await import('leaflet')).default;

		// Leaflet CSS
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
		document.head.appendChild(link);

		map = leaflet.map(mapEl, {
			center: [0, 0],
			zoom: 3,
			zoomControl: true,
			attributionControl: false,
		});

		updateTileLayer();
	});

	function updateTileLayer() {
		if (!map || !leaflet) return;
		if (tileLayer) map.removeLayer(tileLayer);

		const url = useSatellite
			? SATELLITE_URL
			: settingsStore.theme === 'dark' || (settingsStore.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
				? CARTODB_URL
				: CARTODB_LIGHT_URL;

		tileLayer = leaflet.tileLayer(url, { maxZoom: 19 }).addTo(map);
	}

	// Fit to camera bounds when they update
	$effect(() => {
		if (!map || !leaflet || geoLocatedCameras.length === 0) return;
		const bounds = leaflet.latLngBounds(
			geoLocatedCameras.map((c) => [
				c.telemetry!.gps!.latitude,
				c.telemetry!.gps!.longitude,
			] as [number, number])
		);
		map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
	});

	// Update tiles when theme or satellite toggle changes
	$effect(() => {
		void settingsStore.theme;
		void useSatellite;
		updateTileLayer();
	});
</script>

<div class="relative h-full w-full">
	<div bind:this={mapEl} class="h-full w-full"></div>

	<!-- Tile toggle -->
	<div class="absolute top-3 right-3 z-[1000]">
		<button
			class="rounded-md bg-background/90 border px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur hover:bg-accent transition-colors"
			onclick={() => (useSatellite = !useSatellite)}
		>
			{useSatellite ? 'Street' : 'Satellite'}
		</button>
	</div>

	<!-- Camera markers rendered as HTML overlays -->
	{#if map && leaflet}
		{#each geoLocatedCameras as camera (camera.id)}
			<CameraMarker
				{map}
				{leaflet}
				lat={camera.telemetry!.gps!.latitude}
				lng={camera.telemetry!.gps!.longitude}
				name={camera.name}
				connected={camera.connected}
				selected={cameraStore.selectedId === camera.id}
				mode={settingsStore.markerMode}
				onSelect={() => cameraStore.select(camera.id)}
			/>
		{/each}
	{/if}

	{#if geoLocatedCameras.length === 0}
		<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
			<div class="bg-background/80 backdrop-blur rounded-lg px-6 py-4 text-center border shadow-sm">
				<p class="text-sm text-muted-foreground">No cameras with GPS data</p>
				<p class="text-xs text-muted-foreground mt-1">Camera telemetry with GPS coordinates will appear here</p>
			</div>
		</div>
	{/if}
</div>
