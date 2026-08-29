<script lang="ts">
	import type { User } from '$lib/types';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { signOut } from '$lib/stores/auth.svelte';
	import { activeNavHref, shellNav } from '$lib/components/app/shell-nav';
	import ShellNavLinks from '$lib/components/app/shell-nav-links.svelte';
	import MenuIcon from '@lucide/svelte/icons/menu';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import SchoolIcon from '@lucide/svelte/icons/school';

	let { user }: { user: User } = $props();

	const isStudent = $derived(user.role === 'student');
	const nav = $derived(shellNav(user.role));
	const activeHref = $derived(activeNavHref(page.url.pathname, nav));
	let mobileOpen = $state(false);

	async function handleSignOut() {
		mobileOpen = false;
		await signOut();
		await goto('/login', { replaceState: true });
	}
</script>

<header
	class="bg-card sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b px-4 sm:px-6"
>
	<div class="flex items-center gap-2">
		<Sheet.Root bind:open={mobileOpen}>
			<Sheet.Trigger
				class="hover:bg-muted -ml-2 inline-flex size-9 items-center justify-center rounded-md md:hidden"
				aria-label="Open navigation menu"
			>
				<MenuIcon class="size-5" />
			</Sheet.Trigger>
			<Sheet.Content side="left" class="w-64">
				<Sheet.Header class="sr-only">
					<Sheet.Title>Navigation</Sheet.Title>
					<Sheet.Description>Main navigation menu</Sheet.Description>
				</Sheet.Header>
				<nav class="mt-4 flex flex-col gap-1 px-3" aria-label="Main navigation">
					<ShellNavLinks items={nav} {activeHref} onNavigate={() => (mobileOpen = false)} />
				</nav>
			</Sheet.Content>
		</Sheet.Root>
		<a href={isStudent ? '/student' : '/warden'} class="flex items-center gap-2 font-semibold">
			<SchoolIcon class="size-5" aria-hidden="true" />
			<span>HostelGrievance</span>
			<span class="text-muted-foreground hidden text-sm font-normal sm:inline">
				· GIET University
			</span>
		</a>
	</div>
	<div class="flex items-center gap-3">
		<div class="text-right">
			<p class="text-sm leading-tight font-medium">{user.name}</p>
			<p class="text-muted-foreground text-xs leading-tight capitalize">{user.role}</p>
		</div>
		<Button variant="outline" size="sm" onclick={handleSignOut}>
			<LogOutIcon class="size-4" />
			Sign out
		</Button>
	</div>
</header>
