<script lang="ts">
	import { cameraStore } from '$lib/stores/cameras.svelte.js';
	import { settingsStore } from '$lib/stores/settings.svelte.js';
	import CameraCard from '$lib/components/camera/CameraCard.svelte';
	import RecordingTimeline from '$lib/components/timeline/RecordingTimeline.svelte';
	import { cn } from '$lib/utils.js';

	let gridLayout = $derived(settingsStore.gridLayout);

	let gridClass = $derived(() => {
		switch (gridLayout) {
			case '2x2':
				return 'grid-cols-2 grid-rows-2';
			case '1+5':
				return 'grid-cols-3 grid-rows-2';
			default: // auto
				return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
		}
	});

	let cameras = $derived(cameraStore.cameras);
</script>

<div class="flex flex-col h-full">
	<!-- Video grid -->
	<div class={cn("flex-1 grid gap-2 p-2 auto-rows-fr", gridClass())}>
		{#each cameras as camera, i (camera.id)}
			<CameraCard
				sourceId={camera.id}
				name={camera.name}
				connected={camera.connected}
				featured={gridLayout === '1+5' && i === 0}
			/>
		{/each}

		{#if cameras.length === 0}
			<div class="col-span-full flex items-center justify-center text-muted-foreground text-sm">
				No cameras connected. Waiting for feeds...
			</div>
		{/if}
	</div>

	<!-- Recording timeline -->
	<RecordingTimeline cameraId={cameraStore.selectedId} />
</div>
