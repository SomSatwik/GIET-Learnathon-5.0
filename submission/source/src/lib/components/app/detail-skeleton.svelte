<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { Card, CardContent } from '$lib/components/ui/card/index.js';
</script>

<Card>
	<CardContent class="space-y-4 px-4">
		<Skeleton class="h-6 w-2/3" />
		<Skeleton class="h-4 w-40" />
		<Skeleton class="h-4 w-full" />
		<Skeleton class="h-4 w-full" />
		<Skeleton class="h-4 w-5/6" />
	</CardContent>
</Card>
