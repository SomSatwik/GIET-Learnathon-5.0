<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import StatusBadge from '$lib/components/app/status-badge.svelte';
	import PageHeader from '$lib/components/app/page-header.svelte';
	import StatCard from '$lib/components/app/stat-card.svelte';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import ErrorState from '$lib/components/app/error-state.svelte';
	import { grievanceService } from '$lib/services';
	import { getSession } from '$lib/stores/auth.svelte';
	import type { Grievance } from '$lib/types';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';

	let grievances = $state<Grievance[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	const user = $derived(getSession());
	const openCount = $derived(grievances.filter((g) => g.status !== 'Resolved').length);
	const resolvedCount = $derived(grievances.filter((g) => g.status === 'Resolved').length);
	const recent = $derived(grievances.slice(0, 5));

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	async function load() {
		loading = true;
		error = null;
		const uid = getSession()?.id;
		if (!uid) {
			error = 'Session unavailable.';
			loading = false;
			return;
		}
		const result = await grievanceService.listForStudent(uid);
		if (result.ok) {
			grievances = result.data;
		} else {
			error = result.error;
		}
		loading = false;
	}

	load();
</script>

<svelte:head><title>Dashboard · HostelGrievance</title></svelte:head>

<PageHeader title="Welcome, {user?.name ?? 'Student'}" description="Your hostel grievances at a glance.">
	{#snippet actions()}
		<Button href="/student/grievances/new">
			<PlusIcon class="size-4" />
			Create Grievance
		</Button>
	{/snippet}
</PageHeader>

{#if loading}
	<div class="grid gap-4 sm:grid-cols-3">
		<StatCard label="Loading" loading />
		<StatCard label="Loading" loading />
		<StatCard label="Loading" loading />
	</div>
{:else if error}
	<ErrorState message={error} onRetry={load} />
{:else}
	<div class="grid gap-4 sm:grid-cols-3">
		<StatCard label="Total grievances" value={grievances.length} href="/student/grievances" />
		<StatCard label="Open" value={openCount} href="/student/grievances" />
		<StatCard label="Resolved" value={resolvedCount} href="/student/grievances" />
	</div>

	<Card class="mt-6">
		<CardHeader class="flex-row items-center justify-between">
			<CardTitle>Recent grievances</CardTitle>
			<Button variant="ghost" size="sm" href="/student/grievances">
				View all
				<ArrowRightIcon class="size-4" />
			</Button>
		</CardHeader>
		<CardContent>
			{#if recent.length === 0}
				<EmptyState
					title="No grievances yet"
					description="When you file a grievance it will appear here with its current status."
					action={{ label: 'Create your first grievance', href: '/student/grievances/new' }}
				/>
			{:else}
				<ul class="divide-y">
					{#each recent as g (g.id)}
						<li>
							<a
								href="/student/grievances/{g.id}"
								class="hover:bg-muted/50 -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5"
							>
								<div class="min-w-0">
									<p class="truncate text-sm font-medium">{g.title}</p>
									<p class="text-muted-foreground text-xs">
										{g.id} · {g.category} · {formatDate(g.createdAt)}
									</p>
								</div>
								<StatusBadge status={g.status} />
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</CardContent>
	</Card>
{/if}
