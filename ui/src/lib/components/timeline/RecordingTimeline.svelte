<script lang="ts">
	import type { RecordingSegment } from '$lib/types.js';
	import { cn } from '$lib/utils.js';
	import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	let {
		segments = [],
		cameraId,
	}: {
		segments?: RecordingSegment[];
		cameraId?: string | null;
	} = $props();

	let hoverX = $state<number | null>(null);
	let containerWidth = $state(0);
	let containerEl = $state<HTMLDivElement>(undefined as unknown as HTMLDivElement);

	// Timeline zoom levels in hours
	const ZOOM_LEVELS = [1, 4, 8, 12, 24];
	let zoomIndex = $state(4); // Start at 24h
	let windowHours = $derived(ZOOM_LEVELS[zoomIndex]);
	let windowMs = $derived(windowHours * 60 * 60 * 1000);

	let now = $state(Date.now());

	// Update 'now' every minute
	$effect(() => {
		const interval = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(interval);
	});

	// Playback state
	let playing = $state(false);
	let playbackTime = $state<number | null>(null);
	let playbackSpeed = $state(1);
	const SPEEDS = [0.5, 1, 2, 4];

	// Playback timer
	$effect(() => {
		if (!playing || playbackTime === null) return;
		const interval = setInterval(() => {
			playbackTime = (playbackTime ?? 0) + 1000 * playbackSpeed;
			if (playbackTime >= now) {
				playing = false;
				playbackTime = null;
			}
		}, 1000);
		return () => clearInterval(interval);
	});

	let windowStart = $derived(now - windowMs);

	let filteredSegments = $derived(
		segments.filter((s) => {
			if (cameraId && s.camera_id !== cameraId) return false;
			return s.end > windowStart && s.start < now;
		})
	);

	// Generate hour markers based on zoom level
	let hourMarkers = $derived(() => {
		const count = windowHours + 1;
		return Array.from({ length: count }, (_, i) => {
			const t = windowStart + i * (windowMs / windowHours);
			return {
				x: (i / windowHours) * 100,
				label: new Date(t).getHours().toString().padStart(2, '0'),
			};
		});
	});

	// Label interval based on zoom
	let labelInterval = $derived(() => {
		if (windowHours <= 4) return 1;
		if (windowHours <= 12) return 2;
		return 3;
	});

	function segmentStyle(seg: RecordingSegment) {
		const left = Math.max(0, ((seg.start - windowStart) / windowMs) * 100);
		const right = Math.min(100, ((seg.end - windowStart) / windowMs) * 100);
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

	function posToTime(x: number): number {
		if (containerWidth === 0) return windowStart;
		const frac = x / containerWidth;
		return windowStart + frac * windowMs;
	}

	function timeToPos(t: number): number {
		return ((t - windowStart) / windowMs) * containerWidth;
	}

	function formatTime(ts: number): string {
		return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}

	function formatShortTime(ts: number): string {
		return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function handlePointerMove(e: PointerEvent) {
		const rect = containerEl.getBoundingClientRect();
		hoverX = e.clientX - rect.left;
	}

	function handleClick(e: MouseEvent) {
		const rect = containerEl.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const t = posToTime(x);
		playbackTime = Math.max(windowStart, Math.min(t, now));
	}

	function togglePlay() {
		if (playbackTime === null) {
			playbackTime = now - 60_000; // Start 1 min ago
		}
		playing = !playing;
	}

	function stepFrame(direction: number) {
		if (playbackTime === null) playbackTime = now - 60_000;
		playing = false;
		playbackTime = Math.max(windowStart, Math.min((playbackTime ?? now) + direction * 1000 / 30, now));
	}

	function skipTime(seconds: number) {
		if (playbackTime === null) playbackTime = now;
		playbackTime = Math.max(windowStart, Math.min(playbackTime + seconds * 1000, now));
	}

	function cycleSpeed() {
		const idx = SPEEDS.indexOf(playbackSpeed);
		playbackSpeed = SPEEDS[(idx + 1) % SPEEDS.length];
	}

	function zoomIn() {
		if (zoomIndex > 0) zoomIndex--;
	}

	function zoomOut() {
		if (zoomIndex < ZOOM_LEVELS.length - 1) zoomIndex++;
	}

	// Playback position as percentage
	let playbackPosX = $derived(
		playbackTime !== null && containerWidth > 0
			? timeToPos(playbackTime)
			: null
	);

	// "Now" marker position
	let nowPosX = $derived(timeToPos(now));
</script>

<div class="border-t bg-card">
	<!-- Playback controls bar -->
	<div class="flex items-center gap-1 px-2 py-1 border-b border-border/50">
		<!-- Left: playback controls -->
		<div class="flex items-center gap-0.5">
			<Button variant="ghost" size="icon" class="h-6 w-6" onclick={() => skipTime(-10)} title="Back 10s">
				<SkipBack class="h-3 w-3" />
			</Button>
			<Button variant="ghost" size="icon" class="h-6 w-6" onclick={() => stepFrame(-1)} title="Previous frame">
				<ChevronLeft class="h-3 w-3" />
			</Button>
			<Button variant="ghost" size="icon" class="h-7 w-7" onclick={togglePlay} title={playing ? 'Pause' : 'Play'}>
				{#if playing}
					<Pause class="h-3.5 w-3.5" />
				{:else}
					<Play class="h-3.5 w-3.5" />
				{/if}
			</Button>
			<Button variant="ghost" size="icon" class="h-6 w-6" onclick={() => stepFrame(1)} title="Next frame">
				<ChevronRight class="h-3 w-3" />
			</Button>
			<Button variant="ghost" size="icon" class="h-6 w-6" onclick={() => skipTime(10)} title="Forward 10s">
				<SkipForward class="h-3 w-3" />
			</Button>
		</div>

		<!-- Speed -->
		<button
			class="text-[10px] font-mono px-1.5 py-0.5 rounded hover:bg-accent transition-colors"
			onclick={cycleSpeed}
			title="Playback speed"
		>
			{playbackSpeed}x
		</button>

		<!-- Playback time display -->
		<div class="flex-1 text-center">
			{#if playbackTime !== null}
				<span class="text-[10px] font-mono text-muted-foreground">{formatTime(playbackTime)}</span>
			{:else}
				<span class="text-[10px] text-muted-foreground">Live</span>
			{/if}
		</div>

		<!-- Right: zoom + export -->
		<div class="flex items-center gap-0.5">
			<Button variant="ghost" size="icon" class="h-6 w-6" onclick={zoomIn} disabled={zoomIndex === 0} title="Zoom in">
				<ZoomIn class="h-3 w-3" />
			</Button>
			<span class="text-[10px] text-muted-foreground font-mono w-6 text-center">{windowHours}h</span>
			<Button variant="ghost" size="icon" class="h-6 w-6" onclick={zoomOut} disabled={zoomIndex === ZOOM_LEVELS.length - 1} title="Zoom out">
				<ZoomOut class="h-3 w-3" />
			</Button>
			<Button variant="ghost" size="icon" class="h-6 w-6 ml-1" title="Export clip" disabled>
				<Download class="h-3 w-3" />
			</Button>
		</div>
	</div>

	<!-- Timeline bar -->
	<div class="px-4 py-2">
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			bind:this={containerEl}
			bind:clientWidth={containerWidth}
			class="relative h-8 rounded bg-muted overflow-hidden cursor-crosshair"
			role="slider"
			tabindex="0"
			aria-label="Recording timeline"
			aria-valuemin={0}
			aria-valuemax={windowHours}
			aria-valuenow={hoverX !== null && containerWidth > 0 ? Math.round((hoverX / containerWidth) * windowHours) : 0}
			onpointermove={handlePointerMove}
			onpointerleave={() => (hoverX = null)}
			onclick={handleClick}
			onkeydown={(e) => {
				if (!containerWidth) return;
				const step = containerWidth / windowHours;
				if (e.key === 'ArrowRight') {
					hoverX = Math.min((hoverX ?? 0) + step, containerWidth);
				} else if (e.key === 'ArrowLeft') {
					hoverX = Math.max((hoverX ?? 0) - step, 0);
				} else if (e.key === ' ') {
					e.preventDefault();
					togglePlay();
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
			{#each hourMarkers() as hour}
				<div
					class="absolute top-0 bottom-0 w-px bg-border/50"
					style="left: {hour.x}%"
				></div>
			{/each}

			<!-- Hour labels -->
			<div class="absolute inset-x-0 bottom-0 flex">
				{#each hourMarkers() as hour, i}
					{#if i % labelInterval() === 0}
						<span
							class="absolute text-[9px] text-muted-foreground -translate-x-1/2"
							style="left: {hour.x}%; bottom: 1px"
						>{hour.label}:00</span>
					{/if}
				{/each}
			</div>

			<!-- "Now" marker -->
			{#if nowPosX >= 0 && nowPosX <= containerWidth}
				<div
					class="absolute top-0 bottom-0 w-0.5 bg-primary pointer-events-none"
					style="left: {nowPosX}px"
				></div>
			{/if}

			<!-- Playback position marker -->
			{#if playbackPosX !== null && playbackPosX >= 0 && playbackPosX <= containerWidth}
				<div
					class="absolute top-0 bottom-0 w-0.5 bg-yellow-400 pointer-events-none z-10"
					style="left: {playbackPosX}px"
				></div>
				<div
					class="absolute -top-1 w-2.5 h-2.5 rounded-full bg-yellow-400 border border-background pointer-events-none z-10 -translate-x-1/2"
					style="left: {playbackPosX}px"
				></div>
			{/if}

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
					{formatShortTime(posToTime(hoverX))}
				</div>
			{/if}
		</div>
	</div>
</div>
