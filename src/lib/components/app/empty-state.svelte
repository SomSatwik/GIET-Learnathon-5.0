<script lang="ts">
	import { cn } from '$lib/utils.js';

	let {
		title,
		description,
		action,
		class: className
	}: {
		title: string;
		description?: string;
		action?: { label: string; href: string };
		class?: string;
	} = $props();
</script>

<div
	class={cn(
		'border-muted-foreground/25 rounded-lg border border-dashed px-6 py-12 text-center',
		className
	)}
>
	<p class="text-sm font-medium">{title}</p>
	{#if description}
		<p class="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">{description}</p>
	{/if}
	{#if action}
		<a
			href={action.href}
			class="text-primary underline-offset-4 hover:underline mt-3 inline-block text-sm font-medium"
		>
			{action.label}
		</a>
	{/if}
</div>
