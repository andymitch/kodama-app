<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils.js";
	import { setContext } from "svelte";

	let {
		value = $bindable(""),
		class: className,
		children,
		...restProps
	}: HTMLAttributes<HTMLDivElement> & {
		value?: string;
		children?: Snippet;
	} = $props();

	const ctx = $state({ value });
	$effect(() => { ctx.value = value; });
	$effect(() => { value = ctx.value; });
	setContext("toggle-group", ctx);
</script>

<div
	class={cn("inline-flex items-center justify-center gap-1 rounded-lg bg-muted p-1", className)}
	role="group"
	{...restProps}
>
	{#if children}
		{@render children()}
	{/if}
</div>
