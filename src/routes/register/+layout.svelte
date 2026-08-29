<script lang="ts">
	import { goto } from '$app/navigation';
	import { getSession } from '$lib/stores/auth.svelte';

	let { children } = $props();

	// If already authenticated, redirect to appropriate dashboard.
	// This is a UX convenience only — not a security control.
	const user = getSession();
	if (user) {
		goto(user.role === 'warden' ? '/warden' : '/student', { replaceState: true });
	}
</script>

{@render children()}
