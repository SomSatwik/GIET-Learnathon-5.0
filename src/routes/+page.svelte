<script lang="ts">
	import { redirect } from '@sveltejs/kit';
	import { getSession } from '$lib/stores/auth.svelte';

	// Root entry: send the user where their session dictates.
	const user = getSession();
	redirect(307, user ? (user.role === 'warden' ? '/warden' : '/student') : '/login');
</script>
