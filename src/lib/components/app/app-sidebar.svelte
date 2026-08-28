<script lang="ts">
	import type { User } from '$lib/types';
	import { page } from '$app/state';
	import { activeNavHref, shellNav } from '$lib/components/app/shell-nav';
	import ShellNavLinks from '$lib/components/app/shell-nav-links.svelte';

	let { user }: { user: User } = $props();

	const nav = $derived(shellNav(user.role));
	const activeHref = $derived(activeNavHref(page.url.pathname, nav));
</script>

<aside class="bg-card hidden w-56 shrink-0 border-r md:block" aria-label="Main navigation">
	<nav class="flex flex-col gap-1 p-3">
		<ShellNavLinks items={nav} {activeHref} />
	</nav>
</aside>
