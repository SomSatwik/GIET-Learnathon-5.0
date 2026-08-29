<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { ShellNavItem } from '$lib/components/app/shell-nav';

	let {
		items,
		activeHref,
		onNavigate
	}: {
		items: ShellNavItem[];
		activeHref: string | undefined;
		onNavigate?: () => void;
	} = $props();
</script>

{#each items as item (item.href)}
	<a
		href={item.href}
		onclick={() => onNavigate?.()}
		aria-current={activeHref === item.href ? 'page' : undefined}
		class={cn(
			'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium',
			activeHref === item.href
				? 'bg-muted text-foreground'
				: 'text-muted-foreground hover:bg-muted hover:text-foreground'
		)}
	>
		<item.icon class="size-4" />
		{item.label}
	</a>
{/each}
