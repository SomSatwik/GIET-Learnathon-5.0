<script lang="ts">
	/**
	 * Layout guard for all /student/* routes.
	 * Only redirects after the page has mounted (not during SSR/hydration).
	 * The real security is enforced server-side by the Hono API.
	 */
	import { goto } from '$app/navigation';
	import { getSession } from '$lib/stores/auth.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		const user = getSession();
		if (!user) {
			goto('/login', { replaceState: true });
		} else if (user.role !== 'student') {
			goto('/warden', { replaceState: true });
		}
	});
</script>

{@render children()}
