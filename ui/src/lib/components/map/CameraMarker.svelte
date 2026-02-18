<script lang="ts">
	import { onMount } from 'svelte';
	import type L from 'leaflet';
	import type { MarkerMode } from '$lib/types.js';
	import { cn } from '$lib/utils.js';

	let {
		map,
		leaflet,
		lat,
		lng,
		name,
		connected,
		selected,
		mode = 'detailed',
		onSelect,
	}: {
		map: L.Map;
		leaflet: typeof L;
		lat: number;
		lng: number;
		name: string;
		connected: boolean;
		selected: boolean;
		mode?: MarkerMode;
		onSelect?: () => void;
	} = $props();

	let marker: L.Marker | null = null;

	function createIcon() {
		if (!leaflet) return null;

		if (mode === 'dot') {
			return leaflet.divIcon({
				className: '',
				html: `<div class="${cn(
					'h-3 w-3 rounded-full border-2 border-background shadow-md',
					connected ? 'bg-primary' : 'bg-destructive',
					selected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''
				)}"></div>`,
				iconSize: [12, 12],
				iconAnchor: [6, 6],
			});
		}

		// Detailed mode
		return leaflet.divIcon({
			className: '',
			html: `<div class="${cn(
				'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium shadow-md border backdrop-blur-sm cursor-pointer transition-colors',
				connected ? 'bg-background/90 text-foreground' : 'bg-destructive/10 text-destructive border-destructive/30',
				selected ? 'ring-2 ring-primary' : ''
			)}">
				<span class="${cn('h-2 w-2 rounded-full flex-shrink-0', connected ? 'bg-primary' : 'bg-destructive')}"></span>
				<span class="truncate max-w-[100px]">${name}</span>
			</div>`,
			iconSize: [120, 28],
			iconAnchor: [60, 14],
		});
	}

	onMount(() => {
		const icon = createIcon();
		if (!icon) return;

		marker = leaflet.marker([lat, lng], { icon }).addTo(map);
		marker.on('click', () => onSelect?.());

		return () => {
			if (marker) {
				map.removeLayer(marker);
				marker = null;
			}
		};
	});

	// Update position
	$effect(() => {
		if (marker) marker.setLatLng([lat, lng]);
	});

	// Update icon when mode/selected/connected changes
	$effect(() => {
		void mode;
		void selected;
		void connected;
		const icon = createIcon();
		if (marker && icon) marker.setIcon(icon);
	});
</script>
