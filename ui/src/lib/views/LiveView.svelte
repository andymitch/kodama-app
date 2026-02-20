<script lang="ts">
	import { cameraStore } from '$lib/stores/cameras.svelte.js';
	import { cameraConfigStore } from '$lib/stores/cameraConfig.svelte.js';
	import { settingsStore } from '$lib/stores/settings.svelte.js';
	import CameraCard from '$lib/components/camera/CameraCard.svelte';
	import RecordingTimeline from '$lib/components/timeline/RecordingTimeline.svelte';
	import { cn } from '$lib/utils.js';

	let gridLayout = $derived(settingsStore.gridLayout);

	let gridClass = $derived(() => {
		switch (gridLayout) {
			case '1+5':
				return 'grid-cols-3';
			default: // auto
				return 'grid-cols-[repeat(auto-fit,minmax(min(100%,28rem),1fr))]';
		}
	});

	// Apply group filter
	let cameras = $derived(() => {
		const all = cameraStore.cameras;
		if (!cameraConfigStore.activeGroupId) return all;
		return all.filter(
			(c) => cameraConfigStore.getGroupId(c.id) === cameraConfigStore.activeGroupId
		);
	});

	// For 1+5 layout, put selected camera first so it gets the featured (large) slot
	let sortedCameras = $derived(() => {
		const cams = cameras();
		if (gridLayout !== '1+5' || !cameraStore.selectedId) return cams;
		const selected = cams.find((c) => c.id === cameraStore.selectedId);
		if (!selected) return cams;
		return [selected, ...cams.filter((c) => c.id !== cameraStore.selectedId)];
	});
</script>

<div class="flex flex-col h-full overflow-hidden">
	<!-- Video grid -->
	<div class="flex-1 min-h-0 overflow-y-auto p-2">
	<div class={cn("grid gap-3", gridClass())}>
		{#each sortedCameras() as camera, i (camera.id)}
			<CameraCard
				sourceId={camera.id}
				name={cameraConfigStore.getDisplayName(camera.id, camera.name)}
				connected={camera.connected}
				featured={gridLayout === '1+5' && i === 0}
			/>
		{/each}

		{#if cameras().length === 0}
			<div class="col-span-full flex items-center justify-center text-muted-foreground text-sm">
				{#if cameraConfigStore.activeGroupId}
					No cameras in this group
				{:else}
					No cameras connected. Waiting for feeds...
				{/if}
			</div>
		{/if}
	</div>
	</div>

	<!-- Recording timeline -->
	<RecordingTimeline cameraId={cameraStore.selectedId} />
</div>
