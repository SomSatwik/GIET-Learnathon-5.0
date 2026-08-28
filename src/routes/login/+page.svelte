<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { signIn } from '$lib/stores/auth.svelte';
	import SchoolIcon from '@lucide/svelte/icons/school';

	let email = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let submitting = $state(false);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		error = null;

		if (!email.trim()) {
			error = 'Email is required.';
			return;
		}
		if (!password) {
			error = 'Password is required.';
			return;
		}

		submitting = true;
		const result = await signIn(email, password);
		submitting = false;

		if (result.ok) {
			// getSession() is already updated; route guard redirects by role.
			const { getSession } = await import('$lib/stores/auth.svelte');
			const user = getSession();
			await goto(user?.role === 'warden' ? '/warden' : '/student', { replaceState: true });
		} else {
			error = result.error ?? 'Sign-in failed. Please try again.';
		}
	}
</script>

<svelte:head><title>Sign in · HostelGrievance</title></svelte:head>

<main class="bg-muted/30 flex min-h-screen items-center justify-center p-4">
	<div class="w-full max-w-sm">
		<div class="mb-6 flex flex-col items-center text-center">
			<span
				class="bg-primary text-primary-foreground mb-3 flex size-11 items-center justify-center rounded-lg"
				aria-hidden="true"
			>
				<SchoolIcon class="size-6" />
			</span>
			<h1 class="text-xl font-semibold tracking-tight">HostelGrievance</h1>
			<p class="text-muted-foreground mt-1 text-sm">GIET University · Hostel Administration</p>
		</div>

		<Card>
			<CardHeader>
				<CardTitle>Sign in</CardTitle>
				<CardDescription>Use your university account to continue.</CardDescription>
			</CardHeader>
			<CardContent>
				<form onsubmit={handleSubmit} class="space-y-4" novalidate>
					<div class="space-y-1.5">
						<Label for="email">Email</Label>
						<Input
							id="email"
							type="email"
							autocomplete="username"
							placeholder="you@giet.edu"
							bind:value={email}
							aria-invalid={error ? 'true' : undefined}
						/>
					</div>
					<div class="space-y-1.5">
						<Label for="password">Password</Label>
						<Input
							id="password"
							type="password"
							autocomplete="current-password"
							placeholder="••••••••"
							bind:value={password}
							aria-invalid={error ? 'true' : undefined}
						/>
					</div>

					{#if error}
						<p class="text-destructive text-sm" role="alert">{error}</p>
					{/if}

					<Button type="submit" class="w-full" disabled={submitting}>
						{submitting ? 'Signing in…' : 'Sign in'}
					</Button>
				</form>
			</CardContent>
		</Card>

		<p class="text-muted-foreground mt-6 text-center text-xs leading-relaxed">
			Demo environment — development credentials only:<br />
			Student: student@example.test / student123<br />
			Warden: warden@example.test / warden123
		</p>
	</div>
</main>
