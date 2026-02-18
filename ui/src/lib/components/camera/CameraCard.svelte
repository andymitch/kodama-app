<script lang="ts">
	import VideoPlayer from '$lib/components/VideoPlayer.svelte';
	import AudioPlayer from '$lib/components/AudioPlayer.svelte';
	import { cameraStore } from '$lib/stores/cameras.svelte.js';
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
	let muted = $state(true);
</script>

<button
	class={cn(
		"relative overflow-hidden rounded-lg bg-black group cursor-pointer transition-all w-full aspect-video",
		isSelected ? "ring-2 ring-primary" : "ring-1 ring-border/50 hover:ring-border",
		featured ? "col-span-2 row-span-2" : ""
	)}
	onclick={() => cameraStore.select(sourceId)}
>
	<!-- Video feed -->
	<div class="absolute inset-0">
		<VideoPlayer {sourceId} />
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
			<span class={cn(
				"text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded",
				connected ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"
			)}>
				{connected ? 'LIVE' : 'OFF'}
			</span>
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
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
		onclick={(e) => { e.stopPropagation(); muted = !muted; }}
	>
		<span class="text-xs text-white/70 drop-shadow-sm">{muted ? '🔇' : '🔊'}</span>
	</div>
</button>
