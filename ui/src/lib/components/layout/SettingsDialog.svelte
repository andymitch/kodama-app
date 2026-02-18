<script lang="ts">
	import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '$lib/components/ui/sheet/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { settingsStore } from '$lib/stores/settings.svelte.js';
	import { transportStore } from '$lib/stores/transport.svelte.js';
	import type { ServerStatus } from '$lib/types.js';
	import { Sun, Moon, Monitor } from 'lucide-svelte';

	let {
		open = $bindable(false),
	}: {
		open?: boolean;
	} = $props();

	let status = $state<ServerStatus | null>(null);
	let statusError = $state(false);

	$effect(() => {
		if (!open) return;
		statusError = false;
		const transport = transportStore.getTransport();
		transport.getStatus().then((s) => (status = s)).catch(() => { statusError = true; });
	});

	function formatUptime(secs: number): string {
		const h = Math.floor(secs / 3600);
		const m = Math.floor((secs % 3600) / 60);
		return `${h}h ${m}m`;
	}
</script>

<Sheet bind:open>
	<SheetContent side="right">
		<SheetHeader>
			<SheetTitle>Settings</SheetTitle>
			<SheetDescription>Server configuration and preferences</SheetDescription>
		</SheetHeader>

		<div class="mt-6 space-y-6">
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
