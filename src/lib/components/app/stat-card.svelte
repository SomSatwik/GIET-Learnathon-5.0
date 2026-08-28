<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { Card, CardContent } from '$lib/components/ui/card/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import type { Snippet } from 'svelte';

	let {
		label,
		value,
		loading = false,
		href,
		detail,
		class: className
	}: {
		label: string;
		value?: string | number;
		loading?: boolean;
		href?: string;
		detail?: Snippet;
		class?: string;
	} = $props();
</script>

{#snippet body()}
	<Card class={cn('py-4', className)}>
		<CardContent class="px-4">
			<p class="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
			{#if loading}
				<Skeleton class="mt-2 h-7 w-12" />
			{:else}
				<p class="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
			{/if}
			{#if detail}
				{@render detail()}
			{/if}
		</CardContent>
	</Card>
{/snippet}

{#if href && !loading}
	<a {href} class="block rounded-xl transition-opacity hover:opacity-90">
		{@render body()}
	</a>
{:else}
	{@render body()}
{/if}
