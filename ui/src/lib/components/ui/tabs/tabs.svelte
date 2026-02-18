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
	setContext("tabs", ctx);
</script>

<div class={cn("", className)} {...restProps}>
	{#if children}
		{@render children()}
	{/if}
</div>
