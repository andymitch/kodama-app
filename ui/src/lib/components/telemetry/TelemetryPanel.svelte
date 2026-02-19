<script lang="ts">
	import { untrack } from 'svelte';
	import { cameraStore } from '$lib/stores/cameras.svelte.js';
	import Sparkline from './Sparkline.svelte';
	import { cn } from '$lib/utils.js';

	let { sourceId }: { sourceId: string } = $props();

	// Keep recent history for sparklines
	const MAX_HISTORY = 60;
	let cpuHistory = $state<number[]>([]);
	let memHistory = $state<number[]>([]);

	let camera = $derived(cameraStore.cameras.find((c) => c.id === sourceId));
	let telemetry = $derived(camera?.telemetry ?? null);

	// Track history as telemetry updates
	$effect(() => {
		if (!telemetry) return;
		const cpu = telemetry.cpu_usage;
		const mem = telemetry.memory_usage;
		untrack(() => {
			cpuHistory = [...cpuHistory.slice(-(MAX_HISTORY - 1)), cpu];
			memHistory = [...memHistory.slice(-(MAX_HISTORY - 1)), mem];
		});
	});

	function formatUptime(secs: number): string {
		const h = Math.floor(secs / 3600);
		const m = Math.floor((secs % 3600) / 60);
		if (h > 24) {
			const d = Math.floor(h / 24);
			return `${d}d ${h % 24}h`;
		}
		return `${h}h ${m}m`;
	}

	function formatCoord(lat: number, lon: number): string {
		const latDir = lat >= 0 ? 'N' : 'S';
		const lonDir = lon >= 0 ? 'E' : 'W';
		return `${Math.abs(lat).toFixed(5)}${latDir} ${Math.abs(lon).toFixed(5)}${lonDir}`;
	}

	function statusColor(value: number, warn: number, crit: number): string {
		if (value >= crit) return 'text-destructive';
		if (value >= warn) return 'text-warning';
		return 'text-primary';
	}
</script>

{#if telemetry}
	<div class="space-y-3 px-4 pb-4">
		<!-- CPU + sparkline -->
		<div class="flex items-center gap-2">
			<span class="text-[10px] uppercase tracking-wider text-muted-foreground w-8 shrink-0">CPU</span>
			<Sparkline data={cpuHistory} height={18} class="flex-1" />
			<span class={cn("text-xs font-mono font-medium shrink-0", statusColor(telemetry.cpu_usage, 70, 90))}>
				{telemetry.cpu_usage.toFixed(1)}%
			</span>
		</div>

		<!-- Memory + sparkline -->
		<div class="flex items-center gap-2">
			<span class="text-[10px] uppercase tracking-wider text-muted-foreground w-8 shrink-0">MEM</span>
			<Sparkline data={memHistory} height={18} class="flex-1" />
			<span class={cn("text-xs font-mono font-medium shrink-0", statusColor(telemetry.memory_usage, 70, 90))}>
				{telemetry.memory_usage.toFixed(1)}%
			</span>
		</div>

		<!-- Stats grid -->
		<div class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
			<div class="flex justify-between">
				<span class="text-muted-foreground">Disk</span>
				<span class={cn("font-mono", statusColor(telemetry.disk_usage, 80, 95))}>
					{telemetry.disk_usage.toFixed(1)}%
				</span>
			</div>

			{#if telemetry.cpu_temp !== null}
				<div class="flex justify-between">
					<span class="text-muted-foreground">Temp</span>
					<span class={cn("font-mono", statusColor(telemetry.cpu_temp, 70, 85))}>
						{telemetry.cpu_temp.toFixed(1)}&deg;C
					</span>
				</div>
			{/if}

			<div class="flex justify-between">
				<span class="text-muted-foreground">Load</span>
				<span class="font-mono">{telemetry.load_average.map(v => v.toFixed(2)).join(' ')}</span>
			</div>

			<div class="flex justify-between">
				<span class="text-muted-foreground">Uptime</span>
				<span class="font-mono">{formatUptime(telemetry.uptime_secs)}</span>
			</div>

			{#if telemetry.motion_level !== null}
				<div class="flex justify-between">
					<span class="text-muted-foreground">Motion</span>
					<span class={cn("font-mono",
						telemetry.motion_level < 0.1 ? 'text-muted-foreground' :
						telemetry.motion_level < 0.3 ? 'text-primary' :
						telemetry.motion_level < 0.6 ? 'text-warning' : 'text-destructive'
					)}>
						{telemetry.motion_level < 0.1 ? 'None' :
						 telemetry.motion_level < 0.3 ? 'Low' :
						 telemetry.motion_level < 0.6 ? 'Med' : 'High'}
					</span>
				</div>
			{/if}

			{#if telemetry.gps}
				<div class="flex justify-between col-span-2">
					<span class="text-muted-foreground">GPS</span>
					<span class="font-mono text-[10px]">{formatCoord(telemetry.gps.latitude, telemetry.gps.longitude)}</span>
				</div>
				{#if telemetry.gps.speed !== null}
					<div class="flex justify-between">
						<span class="text-muted-foreground">Speed</span>
						<span class="font-mono">{(telemetry.gps.speed * 3.6).toFixed(1)} km/h</span>
					</div>
				{/if}
				{#if telemetry.gps.altitude !== null}
					<div class="flex justify-between">
						<span class="text-muted-foreground">Alt</span>
						<span class="font-mono">{telemetry.gps.altitude.toFixed(1)}m</span>
					</div>
				{/if}
			{/if}
		</div>
	</div>
{:else}
	<div class="px-4 py-6 text-xs text-muted-foreground text-center">
		Waiting for telemetry...
	</div>
{/if}
