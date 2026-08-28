<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import type { GrievanceStatus } from '$lib/types';

	let { status, class: className }: { status: GrievanceStatus; class?: string } = $props();

	// Variant conveys state; text label keeps it readable without color.
	const variant = $derived(
		status === 'Resolved' ? 'secondary' : status === 'In Progress' ? 'outline' : 'default'
	);
</script>

<Badge {variant} class={cn('whitespace-nowrap', className)}>{status}</Badge>
