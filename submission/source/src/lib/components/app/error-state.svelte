<script lang="ts">
	import { Alert, AlertTitle, AlertDescription } from '$lib/components/ui/alert/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';

	let {
		title = 'Something went wrong',
		message,
		onRetry
	}: {
		title?: string;
		message?: string;
		onRetry?: () => void;
	} = $props();
</script>

<Alert variant="destructive">
	<TriangleAlertIcon />
	<AlertTitle>{title}</AlertTitle>
	<AlertDescription>
		<div class="flex flex-wrap items-center gap-3">
			{#if message}
				<span>{message}</span>
			{/if}
			{#if onRetry}
				<Button variant="outline" size="sm" onclick={onRetry}>Try again</Button>
			{/if}
		</div>
	</AlertDescription>
</Alert>
