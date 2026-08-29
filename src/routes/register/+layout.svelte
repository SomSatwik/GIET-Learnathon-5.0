<script lang="ts">
	/**
	 * Layout guard for /register (and /register/warden).
	 * If the user is already authenticated, redirect them to their dashboard.
	 */
	import { goto } from '$app/navigation';
	import { getSession } from '$lib/stores/auth.svelte';

	let { children } = $props();
	const user = $derived(getSession());

	$effect(() => {
		if (user) {
			goto(user.role === 'warden' ? '/warden' : '/student', { replaceState: true });
		}
	});
</script>

{#if !user}
	{@render children()}
{/if}
