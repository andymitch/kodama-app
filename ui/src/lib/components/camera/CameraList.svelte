<script lang="ts">
	import { cameraStore } from '$lib/stores/cameras.svelte.js';
	import { cn } from '$lib/utils.js';

	let {
		onSelect,
	}: {
		onSelect?: () => void;
	} = $props();

	// Sort: online cameras first, then alphabetical
	let sortedCameras = $derived(
		[...cameraStore.cameras].sort((a, b) => {
			if (a.connected !== b.connected) return a.connected ? -1 : 1;
			return a.name.localeCompare(b.name);
		})
	);

	function selectCamera(id: string) {
		cameraStore.select(id);
		onSelect?.();
	}
</script>

<div class="space-y-0.5 py-1">
	{#each sortedCameras as camera (camera.id)}
		<button
			class={cn(
				"w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left",
				"hover:bg-accent/50",
				cameraStore.selectedId === camera.id
					? "bg-accent border-l-2 border-primary"
					: "border-l-2 border-transparent"
			)}
			onclick={() => selectCamera(camera.id)}
		>
			<!-- Status dot -->
			<span
				class={cn(
					"h-2 w-2 rounded-full flex-shrink-0",
					camera.connected ? "bg-primary" : "bg-destructive"
				)}
			></span>

			<!-- Info -->
			<div class="flex-1 min-w-0">
				<div class="truncate font-medium">{camera.name}</div>
				{#if camera.telemetry}
					<div class="text-[10px] text-muted-foreground font-mono">
						CPU {camera.telemetry.cpu_usage.toFixed(0)}%
						{#if camera.telemetry.memory_usage}
							&middot; Mem {camera.telemetry.memory_usage.toFixed(0)}%
						{/if}
					</div>
				{/if}
			</div>

			<!-- Status label -->
			<span class={cn(
				"text-[10px] uppercase tracking-wider flex-shrink-0",
				camera.connected ? "text-primary" : "text-muted-foreground"
			)}>
				{camera.connected ? 'Live' : 'Off'}
			</span>
		</button>
	{/each}

	{#if sortedCameras.length === 0}
		<div class="px-3 py-8 text-center text-xs text-muted-foreground">
			No cameras connected
		</div>
	{/if}
</div>
