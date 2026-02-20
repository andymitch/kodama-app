<script lang="ts">
	import { cameraStore } from '$lib/stores/cameras.svelte.js';
	import { cameraConfigStore } from '$lib/stores/cameraConfig.svelte.js';
	import { videoStatsStore } from '$lib/stores/videoStats.svelte.js';
	import { transportStore } from '$lib/stores/transport.svelte.js';
	import { alertsStore } from '$lib/stores/alerts.svelte.js';
	import Sparkline from '$lib/components/ui/Sparkline.svelte';
	import type { ServerStatus } from '$lib/types.js';
	import { cn } from '$lib/utils.js';

	let status = $state<ServerStatus | null>(null);

	// Periodically fetch server status
	$effect(() => {
		function fetchStatus() {
			transportStore.getTransport().getStatus()
				.then((s) => (status = s))
				.catch(() => {});
		}
		fetchStatus();
		const interval = setInterval(fetchStatus, 5000);
		return () => clearInterval(interval);
	});

	// Aggregate video stats across all cameras
	let totalBitrate = $derived(() => {
		let total = 0;
		for (const cam of cameraStore.cameras) {
			const stats = videoStatsStore.get(cam.id);
			if (stats) total += stats.bitrateKbps;
		}
		return total;
	});

	let totalDropped = $derived(() => {
		let total = 0;
		for (const cam of cameraStore.cameras) {
			const stats = videoStatsStore.get(cam.id);
			if (stats) total += stats.droppedSegments;
		}
		return total;
	});

	// Track bitrate history for sparkline (last 60 samples at 2s intervals = 2 min)
	let bitrateHistory = $state<number[]>([]);
	$effect(() => {
		const interval = setInterval(() => {
			const current = totalBitrate();
			bitrateHistory = [...bitrateHistory.slice(-59), current];
		}, 2000);
		return () => clearInterval(interval);
	});

	// Track frame history
	let frameHistory = $state<number[]>([]);
	let lastFrames = $state(0);
	$effect(() => {
		const interval = setInterval(() => {
			if (status) {
				const delta = status.frames_received - lastFrames;
				lastFrames = status.frames_received;
				if (delta >= 0) {
					frameHistory = [...frameHistory.slice(-59), delta];
				}
			}
		}, 2000);
		return () => clearInterval(interval);
	});

	// Per-camera stats for the table
	let cameraStats = $derived(() => {
		return cameraStore.cameras.map((cam) => {
			const stats = videoStatsStore.get(cam.id);
			const displayName = cameraConfigStore.getDisplayName(cam.id, cam.name);
			return {
				id: cam.id,
				name: displayName,
				connected: cam.connected,
				resolution: stats ? `${stats.width}x${stats.height}` : '-',
				codec: stats?.codec ?? '-',
				bitrate: stats?.bitrateKbps ?? 0,
				dropped: stats?.droppedSegments ?? 0,
				bufferHealth: stats?.bufferHealth ?? 0,
				cpu: cam.telemetry?.cpu_usage ?? null,
				memory: cam.telemetry?.memory_usage ?? null,
				disk: cam.telemetry?.disk_usage ?? null,
				temp: cam.telemetry?.cpu_temp ?? null,
			};
		});
	});

	function formatBitrate(kbps: number): string {
		if (kbps >= 1000) return `${(kbps / 1000).toFixed(1)} Mbps`;
		if (kbps > 0) return `${kbps.toFixed(0)} kbps`;
		return '0 kbps';
	}

	function formatUptime(secs: number): string {
		const d = Math.floor(secs / 86400);
		const h = Math.floor((secs % 86400) / 3600);
		const m = Math.floor((secs % 3600) / 60);
		if (d > 0) return `${d}d ${h}h ${m}m`;
		return `${h}h ${m}m`;
	}
</script>

<div class="h-full overflow-auto p-4 space-y-4">
	<!-- Top stats cards -->
	<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
		<!-- Cameras -->
		<div class="rounded-lg border bg-card p-4">
			<div class="text-xs text-muted-foreground font-medium">Cameras</div>
			<div class="text-2xl font-bold mt-1">
				{cameraStore.onlineCount}<span class="text-sm text-muted-foreground font-normal">/{cameraStore.cameras.length}</span>
			</div>
			<div class="text-[10px] text-muted-foreground mt-1">online</div>
		</div>

		<!-- Bandwidth -->
		<div class="rounded-lg border bg-card p-4">
			<div class="text-xs text-muted-foreground font-medium">Total Bandwidth</div>
			<div class="text-2xl font-bold mt-1">{formatBitrate(totalBitrate())}</div>
			<div class="mt-1">
				<Sparkline data={bitrateHistory} color="hsl(var(--primary))" width={100} height={24} />
			</div>
		</div>

		<!-- Frames -->
		<div class="rounded-lg border bg-card p-4">
			<div class="text-xs text-muted-foreground font-medium">Frames</div>
			<div class="text-2xl font-bold mt-1">
				{status?.frames_received?.toLocaleString() ?? '-'}
			</div>
			<div class="mt-1">
				<Sparkline data={frameHistory} color="hsl(var(--primary))" width={100} height={24} />
			</div>
		</div>

		<!-- Uptime -->
		<div class="rounded-lg border bg-card p-4">
			<div class="text-xs text-muted-foreground font-medium">Server Uptime</div>
			<div class="text-2xl font-bold mt-1">{status ? formatUptime(status.uptime_secs) : '-'}</div>
			<div class="text-[10px] text-muted-foreground mt-1">
				{status?.clients ?? 0} client{(status?.clients ?? 0) !== 1 ? 's' : ''} connected
			</div>
		</div>
	</div>

	<!-- Connection & alerts overview -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
		<!-- Connection -->
		<div class="rounded-lg border bg-card p-4">
			<div class="text-xs text-muted-foreground font-medium mb-2">Connection</div>
			<div class="flex items-center gap-2">
				<span class={cn(
					"h-2.5 w-2.5 rounded-full",
					transportStore.connected ? "bg-primary animate-pulse" : "bg-destructive"
				)}></span>
				<span class="text-sm font-medium">
					{transportStore.connected ? 'Connected' : 'Disconnected'}
				</span>
			</div>
			{#if transportStore.error}
				<p class="text-xs text-destructive mt-1">{transportStore.error}</p>
			{/if}
			{#if status?.public_key}
				<div class="mt-2">
					<span class="text-[10px] text-muted-foreground">Public Key</span>
					<p class="font-mono text-[10px] break-all mt-0.5 text-muted-foreground">{status.public_key}</p>
				</div>
			{/if}
		</div>

		<!-- Dropped frames -->
		<div class="rounded-lg border bg-card p-4">
			<div class="text-xs text-muted-foreground font-medium mb-2">Stream Health</div>
			<div class="space-y-1.5">
				<div class="flex justify-between text-sm">
					<span>Total Dropped</span>
					<span class={cn("font-mono", totalDropped() > 0 ? "text-yellow-500" : "text-primary")}>{totalDropped()}</span>
				</div>
				<div class="flex justify-between text-sm">
					<span>Frames Broadcast</span>
					<span class="font-mono">{status?.frames_broadcast?.toLocaleString() ?? '-'}</span>
				</div>
			</div>
		</div>

		<!-- Alerts summary -->
		<div class="rounded-lg border bg-card p-4">
			<div class="text-xs text-muted-foreground font-medium mb-2">Alerts</div>
			<div class="space-y-1.5">
				<div class="flex justify-between text-sm">
					<span>Unread</span>
					<span class={cn("font-mono", alertsStore.unreadCount > 0 ? "text-destructive" : "")}>{alertsStore.unreadCount}</span>
				</div>
				<div class="flex justify-between text-sm">
					<span>Total</span>
					<span class="font-mono">{alertsStore.alerts.length}</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Per-camera table -->
	<div class="rounded-lg border bg-card overflow-hidden">
		<div class="px-4 py-3 border-b">
			<h3 class="text-sm font-medium">Camera Details</h3>
		</div>
		<div class="overflow-x-auto">
			<table class="w-full text-xs">
				<thead>
					<tr class="border-b text-muted-foreground">
						<th class="text-left px-4 py-2 font-medium">Camera</th>
						<th class="text-left px-3 py-2 font-medium">Status</th>
						<th class="text-left px-3 py-2 font-medium">Resolution</th>
						<th class="text-left px-3 py-2 font-medium">Codec</th>
						<th class="text-right px-3 py-2 font-medium">Bitrate</th>
						<th class="text-right px-3 py-2 font-medium">Buffer</th>
						<th class="text-right px-3 py-2 font-medium">Dropped</th>
						<th class="text-right px-3 py-2 font-medium">CPU</th>
						<th class="text-right px-3 py-2 font-medium">Mem</th>
						<th class="text-right px-3 py-2 font-medium">Disk</th>
						<th class="text-right px-4 py-2 font-medium">Temp</th>
					</tr>
				</thead>
				<tbody>
					{#each cameraStats() as cam (cam.id)}
						<tr class="border-b last:border-0 hover:bg-accent/30">
							<td class="px-4 py-2 font-medium">{cam.name}</td>
							<td class="px-3 py-2">
								<span class={cn(
									"inline-flex items-center gap-1",
									cam.connected ? "text-primary" : "text-destructive"
								)}>
									<span class={cn("h-1.5 w-1.5 rounded-full", cam.connected ? "bg-primary" : "bg-destructive")}></span>
									{cam.connected ? 'Online' : 'Offline'}
								</span>
							</td>
							<td class="px-3 py-2 font-mono">{cam.resolution}</td>
							<td class="px-3 py-2 font-mono">{cam.codec}</td>
							<td class="px-3 py-2 text-right font-mono">{cam.bitrate > 0 ? formatBitrate(cam.bitrate) : '-'}</td>
							<td class="px-3 py-2 text-right font-mono">{cam.bufferHealth > 0 ? `${cam.bufferHealth.toFixed(2)}s` : '-'}</td>
							<td class="px-3 py-2 text-right font-mono">
								<span class={cam.dropped > 0 ? "text-yellow-500" : ""}>{cam.dropped}</span>
							</td>
							<td class="px-3 py-2 text-right font-mono">{cam.cpu !== null ? `${cam.cpu.toFixed(0)}%` : '-'}</td>
							<td class="px-3 py-2 text-right font-mono">{cam.memory !== null ? `${cam.memory.toFixed(0)}%` : '-'}</td>
							<td class="px-3 py-2 text-right font-mono">{cam.disk !== null ? `${cam.disk.toFixed(0)}%` : '-'}</td>
							<td class="px-4 py-2 text-right font-mono">{cam.temp !== null ? `${cam.temp.toFixed(0)}\u00B0C` : '-'}</td>
						</tr>
					{/each}
					{#if cameraStats().length === 0}
						<tr>
							<td colspan="11" class="px-4 py-8 text-center text-muted-foreground">
								No cameras connected
							</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>
