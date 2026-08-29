<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { signUp } from '$lib/stores/auth.svelte';
	import SchoolIcon from '@lucide/svelte/icons/school';

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let room = $state('');
	let error = $state<string | null>(null);
	let submitting = $state(false);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		error = null;
		if (!name.trim()) { error = 'Full name is required.'; return; }
		if (!email.trim()) { error = 'Email is required.'; return; }
		if (!password) { error = 'Password is required.'; return; }
		if (password !== confirmPassword) { error = 'Passwords do not match.'; return; }
		if (!room.trim()) { error = 'Hostel room number is required.'; return; }
		submitting = true;
		const result = await signUp(name, email, password, confirmPassword, room);
		submitting = false;
		if (result.ok) {
			await goto('/student', { replaceState: true });
		} else {
			error = result.error ?? 'Registration failed. Please try again.';
		}
	}
</script>

<svelte:head><title>Create account · HostelGrievance</title></svelte:head>

<main class="bg-muted/30 flex min-h-screen items-center justify-center p-4">
	<div class="w-full max-w-sm">
		<div class="mb-6 flex flex-col items-center text-center">
			<span class="bg-primary text-primary-foreground mb-3 flex size-11 items-center justify-center rounded-lg" aria-hidden="true">
				<SchoolIcon class="size-6" />
			</span>
			<h1 class="text-xl font-semibold tracking-tight">HostelGrievance</h1>
			<p class="text-muted-foreground mt-1 text-sm">GIET University · Hostel Administration</p>
		</div>
		<Card>
			<CardHeader>
				<CardTitle>Create an account</CardTitle>
				<CardDescription>Register as a student to file and track grievances.</CardDescription>
			</CardHeader>
			<CardContent>
				<form onsubmit={handleSubmit} class="space-y-4" novalidate>
					<div class="space-y-1.5">
						<Label for="name">Full name</Label>
						<Input id="name" type="text" autocomplete="name" placeholder="Your full name" bind:value={name} aria-invalid={error ? 'true' : undefined} />
					</div>
					<div class="space-y-1.5">
						<Label for="email">Email</Label>
						<Input id="email" type="email" autocomplete="username" placeholder="you@giet.edu" bind:value={email} aria-invalid={error ? 'true' : undefined} />
					</div>
					<div class="space-y-1.5">
						<Label for="room">Hostel room number</Label>
						<Input id="room" type="text" placeholder="e.g. B-204" bind:value={room} />
					</div>
					<div class="space-y-1.5">
						<Label for="password">Password</Label>
						<Input id="password" type="password" autocomplete="new-password" placeholder="Min 8 characters" bind:value={password} aria-invalid={error ? 'true' : undefined} />
					</div>
					<div class="space-y-1.5">
						<Label for="confirm">Confirm password</Label>
						<Input id="confirm" type="password" autocomplete="new-password" placeholder="••••••••" bind:value={confirmPassword} aria-invalid={error ? 'true' : undefined} />
					</div>
					{#if error}
						<p class="text-destructive text-sm" role="alert">{error}</p>
					{/if}
					<Button type="submit" class="w-full" disabled={submitting}>
						{submitting ? 'Creating account…' : 'Create account'}
					</Button>
				</form>
			</CardContent>
		</Card>
		<p class="text-muted-foreground mt-3 text-center text-sm">
			Already have an account?
			<a href="/login" class="text-foreground font-medium underline-offset-4 hover:underline">Sign in</a>
		</p>
	</div>
</main>
