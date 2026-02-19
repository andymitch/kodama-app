<script lang="ts">
	import type { RecordingSegment } from '$lib/types.js';
	import { cn } from '$lib/utils.js';

	let {
		segments = [],
		cameraId,
	}: {
		segments?: RecordingSegment[];
		cameraId?: string | null;
	} = $props();

	let hoverX = $state<number | null>(null);
	let containerWidth = $state(0);
	let containerEl: HTMLDivElement;

	// 24-hour window ending now
	const WINDOW_MS = 24 * 60 * 60 * 1000;
	let now = $state(Date.now());

	// Update 'now' every minute
	$effect(() => {
		const interval = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(interval);
	});

	let windowStart = $derived(now - WINDOW_MS);

	let filteredSegments = $derived(
		segments.filter((s) => {
			if (cameraId && s.camera_id !== cameraId) return false;
			return s.end > windowStart && s.start < now;
		})
	);

	let hours = $derived(
		Array.from({ length: 25 }, (_, i) => {
			const t = windowStart + i * (WINDOW_MS / 24);
			return {
				x: (i / 24) * 100,
				label: new Date(t).getHours().toString().padStart(2, '0'),
			};
		})
	);

	function segmentStyle(seg: RecordingSegment) {
		const left = Math.max(0, ((seg.start - windowStart) / WINDOW_MS) * 100);
		const right = Math.min(100, ((seg.end - windowStart) / WINDOW_MS) * 100);
		const width = right - left;
		return `left: ${left}%; width: ${width}%;`;
	}

	function segmentColor(type: RecordingSegment['type']) {
		switch (type) {
			case 'motion': return 'bg-primary/60';
			case 'alert': return 'bg-destructive/60';
			case 'continuous': return 'bg-blue-500/40';
		}
	}

	function hoverTime(x: number): string {
		if (containerWidth === 0) return '';
		const frac = x / containerWidth;
		const ts = windowStart + frac * WINDOW_MS;
		return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function handlePointerMove(e: PointerEvent) {
		const rect = containerEl.getBoundingClientRect();
		hoverX = e.clientX - rect.left;
	}
</script>

<div class="border-t bg-card px-4 py-2">
	<div
		bind:this={containerEl}
		bind:clientWidth={containerWidth}
		class="relative h-8 rounded bg-muted overflow-hidden cursor-crosshair"
		role="slider"
		tabindex="0"
		aria-label="Recording timeline"
		aria-valuemin={0}
		aria-valuemax={24}
		aria-valuenow={hoverX !== null && containerWidth > 0 ? Math.round((hoverX / containerWidth) * 24) : 0}
		onpointermove={handlePointerMove}
		onpointerleave={() => (hoverX = null)}
		onkeydown={(e) => {
			if (!containerWidth) return;
			const step = containerWidth / 24;
			if (e.key === 'ArrowRight') {
				hoverX = Math.min((hoverX ?? 0) + step, containerWidth);
			} else if (e.key === 'ArrowLeft') {
				hoverX = Math.max((hoverX ?? 0) - step, 0);
			}
		}}
	>
		<!-- Segments -->
		{#each filteredSegments as seg (seg.camera_id + seg.start)}
			<div
				class={cn("absolute inset-y-0 rounded-sm", segmentColor(seg.type))}
				style={segmentStyle(seg)}
			></div>
		{/each}

		<!-- Hour markers -->
		{#each hours as hour}
			<div
				class="absolute top-0 bottom-0 w-px bg-border/50"
				style="left: {hour.x}%"
			></div>
		{/each}

		<!-- Hour labels -->
		<div class="absolute inset-x-0 bottom-0 flex">
			{#each hours as hour, i}
				{#if i % 3 === 0}
					<span
						class="absolute text-[9px] text-muted-foreground -translate-x-1/2"
						style="left: {hour.x}%; bottom: 1px"
					>{hour.label}:00</span>
				{/if}
			{/each}
		</div>

		<!-- Hover cursor -->
		{#if hoverX !== null}
			<div
				class="absolute top-0 bottom-0 w-px bg-foreground/50 pointer-events-none"
				style="left: {hoverX}px"
			></div>
			<div
				class="absolute -top-6 text-[10px] bg-popover text-popover-foreground px-1.5 py-0.5 rounded border shadow pointer-events-none -translate-x-1/2"
				style="left: {hoverX}px"
			>
				{hoverTime(hoverX)}
			</div>
		{/if}
	</div>
</div>
