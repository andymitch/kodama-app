<script lang="ts">
	import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '$lib/components/ui/sheet/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { settingsStore } from '$lib/stores/settings.svelte.js';
	import { transportStore } from '$lib/stores/transport.svelte.js';
	import type { ServerStatus } from '$lib/types.js';
	import { cameraConfigStore } from '$lib/stores/cameraConfig.svelte.js';
	import { Sun, Moon, Monitor, Bug, Plus, Trash2 } from 'lucide-svelte';
	import { formatUptime } from '$lib/utils/format.js';

	let {
		open = $bindable(false),
	}: {
		open?: boolean;
	} = $props();

	let status = $state<ServerStatus | null>(null);
	let statusError = $state(false);
	let newGroupName = $state('');

	$effect(() => {
		if (!open) return;
		statusError = false;
		const transport = transportStore.getTransport();
		transport.getStatus().then((s) => (status = s)).catch(() => { statusError = true; });
	});

</script>

<Sheet bind:open>
	<SheetContent side="right">
		<SheetHeader>
			<SheetTitle>Settings</SheetTitle>
			<SheetDescription>Server configuration and preferences</SheetDescription>
		</SheetHeader>

		<div class="mt-6 space-y-6 overflow-y-auto" style="max-height: calc(100vh - 8rem);">
			<!-- Theme -->
			<div>
				<h3 class="text-sm font-medium mb-3">Theme</h3>
				<div class="flex gap-2">
					<Button
						variant={settingsStore.theme === 'light' ? 'default' : 'outline'}
						size="sm"
						onclick={() => settingsStore.setTheme('light')}
					>
						<Sun class="h-4 w-4 mr-1.5" />
						Light
					</Button>
					<Button
						variant={settingsStore.theme === 'dark' ? 'default' : 'outline'}
						size="sm"
						onclick={() => settingsStore.setTheme('dark')}
					>
						<Moon class="h-4 w-4 mr-1.5" />
						Dark
					</Button>
					<Button
						variant={settingsStore.theme === 'system' ? 'default' : 'outline'}
						size="sm"
						onclick={() => settingsStore.setTheme('system')}
					>
						<Monitor class="h-4 w-4 mr-1.5" />
						System
					</Button>
				</div>
			</div>

			<Separator />

			<!-- Camera Groups -->
			<div>
				<h3 class="text-sm font-medium mb-3">Camera Groups</h3>
				<div class="space-y-2">
					{#each cameraConfigStore.groups as group (group.id)}
						<div class="flex items-center gap-2">
							<span class="text-xs flex-1 truncate">{group.name}</span>
							<button
								class="p-1 text-muted-foreground hover:text-destructive transition-colors"
								onclick={() => cameraConfigStore.deleteGroup(group.id)}
								aria-label="Delete group"
							>
								<Trash2 class="h-3.5 w-3.5" />
							</button>
						</div>
					{/each}
					{#if cameraConfigStore.groups.length === 0}
						<p class="text-xs text-muted-foreground">No groups created yet</p>
					{/if}
					<div class="flex items-center gap-2 mt-2">
						<input
							type="text"
							bind:value={newGroupName}
							placeholder="New group name..."
							class="flex-1 text-xs px-2 py-1.5 rounded border border-input bg-background"
							onkeydown={(e) => {
								if (e.key === 'Enter' && newGroupName.trim()) {
									cameraConfigStore.addGroup(newGroupName);
									newGroupName = '';
								}
							}}
						/>
						<Button
							variant="outline"
							size="sm"
							disabled={!newGroupName.trim()}
							onclick={() => {
								if (newGroupName.trim()) {
									cameraConfigStore.addGroup(newGroupName);
									newGroupName = '';
								}
							}}
						>
							<Plus class="h-3.5 w-3.5" />
						</Button>
					</div>
				</div>
				<p class="text-xs text-muted-foreground mt-2">Groups let you organize cameras by location. Assign cameras via the sidebar camera list.</p>
			</div>

			<Separator />

			<!-- Server status -->
			<div>
				<h3 class="text-sm font-medium mb-3">Server Status</h3>
				{#if status}
					<div class="space-y-2 text-sm">
						{#if status.public_key}
							<div>
								<span class="text-muted-foreground">Public Key</span>
								<p class="font-mono text-xs break-all mt-0.5">{status.public_key}</p>
							</div>
						{/if}
						<div class="grid grid-cols-2 gap-2 text-xs">
							<div class="flex justify-between">
								<span class="text-muted-foreground">Cameras</span>
								<span class="font-mono">{status.cameras}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-muted-foreground">Clients</span>
								<span class="font-mono">{status.clients}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-muted-foreground">Uptime</span>
								<span class="font-mono">{formatUptime(status.uptime_secs)}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-muted-foreground">Frames</span>
								<span class="font-mono">{status.frames_received}/{status.frames_broadcast}</span>
							</div>
						</div>
					</div>
				{:else if statusError}
					<p class="text-xs text-muted-foreground">Server unreachable</p>
				{:else}
					<p class="text-xs text-muted-foreground">Loading server status...</p>
				{/if}
			</div>

			<Separator />

			<!-- Debug mode -->
			<div>
				<h3 class="text-sm font-medium mb-3">Developer</h3>
				<Button
					variant={settingsStore.debugMode ? 'default' : 'outline'}
					size="sm"
					onclick={() => (settingsStore.debugMode = !settingsStore.debugMode)}
				>
					<Bug class="h-4 w-4 mr-1.5" />
					Debug Overlay
				</Button>
				<p class="text-xs text-muted-foreground mt-1.5">Show video stats on camera cards (codec, bitrate, buffer)</p>
			</div>

			<Separator />

			<!-- Connection status -->
			<div>
				<h3 class="text-sm font-medium mb-2">Connection</h3>
				<div class="flex items-center gap-2 text-sm">
					<span class={transportStore.connected ? 'text-primary' : 'text-destructive'}>
						{transportStore.connected ? 'Connected' : 'Disconnected'}
					</span>
					{#if transportStore.error}
						<span class="text-xs text-destructive">{transportStore.error}</span>
					{/if}
				</div>
			</div>
		</div>
	</SheetContent>
</Sheet>
