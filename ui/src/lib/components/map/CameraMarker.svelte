<script lang="ts">
	import { onMount } from 'svelte';
	import type L from 'leaflet';
	import type { MarkerMode, TelemetryEvent } from '$lib/types.js';
	import { cn } from '$lib/utils.js';

	// Inline SVG icons (14x14) for compact markers
	const CPU_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>`;
	const MEM_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 19v-3"/><path d="M10 19v-3"/><path d="M14 19v-3"/><path d="M18 19v-3"/><path d="M8 11V9"/><path d="M16 11V9"/><path d="M12 11V9"/><path d="M2 15h20"/><path d="M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1.1a2 2 0 0 0 0 3.837V17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5.1a2 2 0 0 0 0-3.837Z"/></svg>`;
	const TEMP_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>`;

	let {
		map,
		leaflet,
		lat,
		lng,
		name,
		connected,
		selected,
		mode = 'detailed',
		telemetry,
		sourceId,
		thumbnail,
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
		telemetry?: TelemetryEvent;
		sourceId?: string;
		thumbnail?: string;
		onSelect?: () => void;
	} = $props();

	let marker: L.Marker | null = null;

	function escapeHtml(str: string): string {
		return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}

	function safeBgStyle(url: string | undefined): string {
		if (!url) return '';
		// Only allow data: URIs (from canvas.toDataURL) and https: URLs
		if (!url.startsWith('data:image/') && !url.startsWith('https://')) return '';
		return `background-image:url('${url.replace(/'/g, "\\'")}');background-size:cover;background-position:center`;
	}

	function createIcon() {
		if (!leaflet) return null;

		const cpu = telemetry?.cpu_usage?.toFixed(0) ?? '--';
		const mem = telemetry?.memory_usage?.toFixed(0) ?? '--';
		const temp = telemetry?.cpu_temp != null ? `${telemetry.cpu_temp.toFixed(0)}°` : '';

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

		if (mode === 'pip') {
			const bgStyle = safeBgStyle(thumbnail);
			return leaflet.divIcon({
				className: '',
				html: `<div class="${cn(
					'rounded-lg overflow-hidden shadow-lg border cursor-pointer',
					selected ? 'ring-2 ring-primary' : 'ring-1 ring-border/50'
				)}" style="width:160px;height:100px">
					<div class="relative w-full h-full bg-black" style="${bgStyle}">
						<div class="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-2 pt-1 pb-3">
							<div class="flex items-center gap-1">
								<span class="${cn('h-1.5 w-1.5 rounded-full', connected ? 'bg-primary' : 'bg-destructive')}"></span>
								<span class="text-[9px] text-white/90 font-medium truncate">${escapeHtml(name)}</span>
							</div>
						</div>
						<div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1 pt-3">
							<div class="flex items-center gap-2 text-[8px] text-white/60 font-mono">
								<span class="flex items-center gap-0.5">${CPU_ICON}${cpu}%</span>
								<span class="flex items-center gap-0.5">${MEM_ICON}${mem}%</span>
								${temp ? `<span class="flex items-center gap-0.5">${TEMP_ICON}${temp}</span>` : ''}
							</div>
						</div>
					</div>
				</div>`,
				iconSize: [160, 100],
				iconAnchor: [80, 50],
			});
		}

		// Detailed mode - single-line compact telemetry with icons
		return leaflet.divIcon({
			className: 'leaflet-marker-detailed',
			html: `<div style="transform: translate(-50%, -50%)" class="${cn(
				'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] shadow-md border backdrop-blur-sm cursor-pointer whitespace-nowrap',
				connected ? 'bg-background/90 text-foreground' : 'bg-destructive/10 text-destructive border-destructive/30',
				selected ? 'ring-2 ring-primary' : ''
			)}">
				<span class="${cn('h-2 w-2 rounded-full flex-shrink-0', connected ? 'bg-primary' : 'bg-destructive')}"></span>
				<span class="font-medium">${escapeHtml(name)}</span>
				<span class="text-muted-foreground">·</span>
				<span class="flex items-center gap-0.5 text-muted-foreground font-mono">${CPU_ICON}${cpu}%</span>
				<span class="flex items-center gap-0.5 text-muted-foreground font-mono">${MEM_ICON}${mem}%</span>
				${temp ? `<span class="flex items-center gap-0.5 text-muted-foreground font-mono">${TEMP_ICON}${temp}</span>` : ''}
			</div>`,
			iconSize: [0, 0],
			iconAnchor: [0, 0],
		});
	}

	onMount(() => {
		const icon = createIcon();
		if (!icon) return;

		marker = leaflet.marker([lat, lng], { icon, bubblingMouseEvents: false }).addTo(map);
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

	// Update icon when mode/selected/connected/telemetry/thumbnail changes
	$effect(() => {
		// Access reactive props to establish dependencies
		const _deps = [mode, selected, connected, telemetry, thumbnail];
		const icon = createIcon();
		if (marker && icon) marker.setIcon(icon);
	});
</script>
