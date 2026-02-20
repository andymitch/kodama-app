<script lang="ts">
	import { cameraStore } from '$lib/stores/cameras.svelte.js';
	import { cameraConfigStore } from '$lib/stores/cameraConfig.svelte.js';
	import { settingsStore } from '$lib/stores/settings.svelte.js';
	import { cn } from '$lib/utils.js';
	import { Pencil, Check, X } from 'lucide-svelte';

	let {
		onSelect,
	}: {
		onSelect?: () => void;
	} = $props();

	let editingId = $state<string | null>(null);
	let editingName = $state('');
	let editingGroupId = $state<string | null>(null);

	// Sort: online cameras first, then alphabetical (using display names)
	let sortedCameras = $derived(
		[...cameraStore.cameras].sort((a, b) => {
			if (a.connected !== b.connected) return a.connected ? -1 : 1;
			const nameA = cameraConfigStore.getDisplayName(a.id, a.name);
			const nameB = cameraConfigStore.getDisplayName(b.id, b.name);
			return nameA.localeCompare(nameB);
		})
	);

	// Active filter applied
	let filteredCameras = $derived(() => {
		if (cameraConfigStore.activeGroupId === null) return sortedCameras;
		return sortedCameras.filter(
			(c) => cameraConfigStore.getGroupId(c.id) === cameraConfigStore.activeGroupId
		);
	});

	function selectCamera(id: string) {
		cameraStore.select(id);
		onSelect?.();
	}

	function startEdit(id: string, currentName: string) {
		editingId = id;
		editingName = currentName;
		editingGroupId = cameraConfigStore.getGroupId(id) ?? null;
	}

	function confirmEdit() {
		if (editingId) {
			cameraConfigStore.rename(editingId, editingName);
			cameraConfigStore.assignGroup(editingId, editingGroupId);
			editingId = null;
		}
	}

	function cancelEdit() {
		editingId = null;
	}

	function handleEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') confirmEdit();
		else if (e.key === 'Escape') cancelEdit();
	}
</script>

<div class="space-y-0.5 py-1">
	{#if cameraConfigStore.groups.length > 0}
		<!-- Group filter chips -->
		<div class="flex flex-wrap gap-1 px-3 pb-2">
			<button
				class={cn(
					"text-[10px] px-2 py-0.5 rounded-full border transition-colors",
					cameraConfigStore.activeGroupId === null
						? "bg-primary text-primary-foreground border-primary"
						: "border-border text-muted-foreground hover:border-foreground/30"
				)}
				onclick={() => cameraConfigStore.setFilter(null)}
			>
				All
			</button>
			{#each cameraConfigStore.groups as group (group.id)}
				<button
					class={cn(
						"text-[10px] px-2 py-0.5 rounded-full border transition-colors",
						cameraConfigStore.activeGroupId === group.id
							? "bg-primary text-primary-foreground border-primary"
							: "border-border text-muted-foreground hover:border-foreground/30"
					)}
					onclick={() => cameraConfigStore.setFilter(group.id)}
				>
					{group.name}
				</button>
			{/each}
		</div>
	{/if}

	{#each filteredCameras() as camera (camera.id)}
		{@const displayName = cameraConfigStore.getDisplayName(camera.id, camera.name)}
		<div class="group/item relative">
			{#if editingId === camera.id}
				<!-- Inline edit (name + group) -->
				<div class="px-3 py-2 space-y-1.5">
					<div class="flex items-center gap-1">
						<span
							class={cn(
								"h-2 w-2 rounded-full flex-shrink-0",
								camera.connected ? "bg-primary" : "bg-destructive"
							)}
						></span>
						<input
							type="text"
							bind:value={editingName}
							onkeydown={handleEditKeydown}
							class="flex-1 min-w-0 text-sm bg-transparent border-b border-primary outline-none px-1"
							autofocus
						/>
						<button class="p-0.5 hover:text-primary" onclick={confirmEdit} aria-label="Confirm">
							<Check class="h-3.5 w-3.5" />
						</button>
						<button class="p-0.5 hover:text-destructive" onclick={cancelEdit} aria-label="Cancel">
							<X class="h-3.5 w-3.5" />
						</button>
					</div>
					{#if cameraConfigStore.groups.length > 0}
						<select
							bind:value={editingGroupId}
							class="w-full text-[10px] px-1.5 py-1 rounded border border-input bg-background text-foreground"
						>
							<option value={null}>No group</option>
							{#each cameraConfigStore.groups as group (group.id)}
								<option value={group.id}>{group.name}</option>
							{/each}
						</select>
					{/if}
				</div>
			{:else}
				<button
					class={cn(
						"w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left",
						"hover:bg-accent/50",
						cameraStore.selectedId === camera.id
							? "bg-accent border-l-2 border-primary"
							: "border-l-2 border-transparent"
					)}
					onclick={() => selectCamera(camera.id)}
					ondblclick={() => settingsStore.openCameraView(camera.id)}
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
						<div class="flex items-center gap-1.5">
							<span class="truncate font-medium">{displayName}</span>
							{#if cameraConfigStore.getGroupId(camera.id)}
								{@const group = cameraConfigStore.groups.find((g) => g.id === cameraConfigStore.getGroupId(camera.id))}
								{#if group}
									<span class="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{group.name}</span>
								{/if}
							{/if}
						</div>
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

				<!-- Edit button (visible on hover) -->
				<button
					class="absolute right-8 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover/item:opacity-100 hover:bg-accent transition-opacity"
					onclick={(e) => { e.stopPropagation(); startEdit(camera.id, displayName); }}
					aria-label="Edit camera"
				>
					<Pencil class="h-3 w-3 text-muted-foreground" />
				</button>
			{/if}
		</div>
	{/each}

	{#if filteredCameras().length === 0}
		<div class="px-3 py-8 text-center text-xs text-muted-foreground">
			{#if cameraConfigStore.activeGroupId}
				No cameras in this group
			{:else}
				No cameras connected
			{/if}
		</div>
	{/if}
</div>
