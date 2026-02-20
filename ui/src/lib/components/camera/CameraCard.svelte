<script lang="ts">
	import { onMount } from 'svelte';
	import VideoPlayer from '$lib/components/VideoPlayer.svelte';
	import AudioPlayer from '$lib/components/AudioPlayer.svelte';
	import { cameraStore } from '$lib/stores/cameras.svelte.js';
	import { settingsStore } from '$lib/stores/settings.svelte.js';
	import { videoStatsStore } from '$lib/stores/videoStats.svelte.js';
	import { cn } from '$lib/utils.js';

	let {
		sourceId,
		name,
		connected,
		featured = false,
	}: {
		sourceId: string;
		name: string;
		connected: boolean;
		featured?: boolean;
	} = $props();

	let isSelected = $derived(cameraStore.selectedId === sourceId);
	let camera = $derived(cameraStore.cameras.find((c) => c.id === sourceId));
	let stats = $derived(videoStatsStore.get(sourceId));
	let muted = $derived(!isSelected);
	let videoElement = $state<HTMLVideoElement | undefined>(undefined);
	let cardEl = $state<HTMLButtonElement>(undefined as unknown as HTMLButtonElement);
	let isVisible = $state(true);

	// Lazy rendering: pause video decode when card is off-screen
	onMount(() => {
		if (!cardEl || typeof IntersectionObserver === 'undefined') return;
		const observer = new IntersectionObserver(
			([entry]) => { isVisible = entry.isIntersecting; },
			{ threshold: 0 }
		);
		observer.observe(cardEl);
		return () => observer.disconnect();
	});

	function captureSnapshot(e: MouseEvent) {
		e.stopPropagation();
		if (!videoElement || videoElement.videoWidth === 0) return;
		const canvas = document.createElement('canvas');
		canvas.width = videoElement.videoWidth;
		canvas.height = videoElement.videoHeight;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.drawImage(videoElement, 0, 0);
		const link = document.createElement('a');
		link.download = `${name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
		link.href = canvas.toDataURL('image/png');
		link.click();
	}

	function togglePiP(e: MouseEvent) {
		e.stopPropagation();
		if (!videoElement) return;
		if (document.pictureInPictureElement === videoElement) {
			document.exitPictureInPicture().catch(() => {});
		} else {
			videoElement.requestPictureInPicture().catch(() => {});
		}
	}

	function formatBitrate(kbps: number): string {
		if (kbps >= 1000) return `${(kbps / 1000).toFixed(1)}M`;
		if (kbps > 0) return `${kbps.toFixed(0)}k`;
		return '';
	}
</script>

<button
	bind:this={cardEl}
	class={cn(
		"relative overflow-hidden rounded-lg bg-black group cursor-pointer transition-all w-full aspect-video",
		isSelected ? "ring-2 ring-primary" : "ring-1 ring-border/50 hover:ring-border",
		featured ? "col-span-2 row-span-2" : ""
	)}
	onclick={() => cameraStore.select(sourceId)}
	ondblclick={() => settingsStore.openCameraView(sourceId)}
>
	<!-- Video feed -->
	<div class="absolute inset-0">
		<VideoPlayer {sourceId} bind:videoElement active={isVisible} />
	</div>

	<!-- Top gradient overlay -->
	<div class="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
		<div class="flex items-center justify-between px-3 pt-2">
			<div class="flex items-center gap-2">
				<span class={cn(
					"h-2 w-2 rounded-full",
					connected ? "bg-primary animate-pulse" : "bg-destructive"
				)}></span>
				<span class="text-xs font-medium text-white/90 drop-shadow-sm">{name}</span>
			</div>
			<div class="flex items-center gap-1.5">
				{#if stats && stats.width > 0}
					<span class="text-[9px] text-white/50 font-mono">{stats.width}x{stats.height}</span>
					{#if stats.bitrateKbps > 0}
						<span class="text-[9px] text-white/50 font-mono">{formatBitrate(stats.bitrateKbps)}</span>
					{/if}
				{/if}
				<span class={cn(
					"text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded",
					connected ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"
				)}>
					{connected ? 'LIVE' : 'OFF'}
				</span>
			</div>
		</div>
	</div>

	<!-- Bottom gradient overlay -->
	<div class="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
		<div class="flex items-center justify-between px-3 pb-2 absolute bottom-0 inset-x-0">
			{#if camera?.telemetry}
				<div class="flex items-center gap-3 text-[10px] text-white/70 font-mono">
					<span>CPU {camera.telemetry.cpu_usage.toFixed(0)}%</span>
					<span>Mem {camera.telemetry.memory_usage.toFixed(0)}%</span>
					{#if camera.telemetry.cpu_temp !== null}
						<span>{camera.telemetry.cpu_temp.toFixed(0)}&deg;C</span>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Audio -->
	<AudioPlayer {sourceId} {muted} />

	<!-- Action buttons (hover) -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="absolute bottom-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
		<div class="cursor-pointer rounded bg-black/50 px-1.5 py-0.5" onclick={captureSnapshot} title="Save snapshot">
			<span class="text-[10px] text-white/70">&#128247;</span>
		</div>
		<div class="cursor-pointer rounded bg-black/50 px-1.5 py-0.5" onclick={togglePiP} title="Picture-in-Picture">
			<span class="text-[10px] text-white/70">&#128250;</span>
		</div>
		<div class="rounded bg-black/50 px-1.5 py-0.5" title={muted ? 'Select to unmute' : 'Audio active'}>
			<span class="text-[10px] text-white/70">{muted ? '🔇' : '🔊'}</span>
		</div>
	</div>

	<!-- Buffer health indicator -->
	{#if stats && stats.droppedSegments > 0 && !settingsStore.debugMode}
		<div class="absolute top-8 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
			<span class="text-[9px] text-yellow-400/80 font-mono bg-black/50 rounded px-1 py-0.5">
				{stats.droppedSegments} dropped
			</span>
		</div>
	{/if}

	<!-- Debug overlay -->
	{#if settingsStore.debugMode && stats}
		<div class="absolute top-8 left-2 z-10 pointer-events-none">
			<div class="bg-black/70 rounded px-1.5 py-1 text-[9px] font-mono text-green-400 leading-relaxed">
				<div>{stats.width}x{stats.height} {stats.codec}</div>
				<div>{formatBitrate(stats.bitrateKbps)}bps</div>
				<div>buf {stats.bufferHealth.toFixed(2)}s</div>
				<div>seg {stats.segmentsAppended}</div>
				{#if stats.droppedSegments > 0}
					<div class="text-yellow-400">drop {stats.droppedSegments}</div>
				{/if}
				{#if !isVisible}
					<div class="text-orange-400">PAUSED</div>
				{/if}
			</div>
		</div>
	{/if}
</button>
