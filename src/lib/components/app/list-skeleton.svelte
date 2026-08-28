<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';

	let { rows = 4 }: { rows?: number } = $props();
</script>

<Card>
	<CardContent class="space-y-3 px-4">
		<Skeleton class="h-5 w-40" />
		{#each Array.from({ length: rows }) as _, i (i)}
			<Skeleton class="h-12 w-full" />
		{/each}
	</CardContent>
</Card>
