<script lang="ts">
	import { goto } from '$app/navigation';
	import { getSession } from '$lib/stores/auth.svelte';

	let { children } = $props();
	const user = $derived(getSession());

	$effect(() => {
		if (!user) {
			goto('/login', { replaceState: true });
		} else if (user.role !== 'warden') {
			goto('/student', { replaceState: true });
		}
	});
</script>

{@render children()}
