<script lang="ts">
	/**
	 * Layout guard for all /student/* routes.
	 * Redirects unauthenticated visitors to /login.
	 * Redirects wardens to their own dashboard.
	 * NOTE: this is a UX-level redirect only.
	 * Server-side authorization is enforced by the Hono API independently.
	 */
	import { goto } from '$app/navigation';
	import { getSession } from '$lib/stores/auth.svelte';
	import { page } from '$app/state';

	let { children } = $props();
	const user = $derived(getSession());

	$effect(() => {
		if (!user) {
			goto('/login', { replaceState: true });
		} else if (user.role !== 'student') {
			goto('/warden', { replaceState: true });
		}
	});
</script>

{#if user?.role === 'student'}
	{@render children()}
{/if}
