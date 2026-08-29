<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		actions,
		class: className
	}: {
		title: string;
		description?: string;
		actions?: Snippet;
		class?: string;
	} = $props();
</script>

<div class={cn('mb-6 flex flex-wrap items-start justify-between gap-3', className)}>
	<div class="min-w-0">
		<h1 class="text-xl font-semibold tracking-tight">{title}</h1>
		{#if description}
			<p class="text-muted-foreground mt-1 text-sm">{description}</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex shrink-0 items-center gap-2">{@render actions()}</div>
	{/if}
</div>
