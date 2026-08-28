<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table/index.js';
	import StatusBadge from '$lib/components/app/status-badge.svelte';
	import PageHeader from '$lib/components/app/page-header.svelte';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import ErrorState from '$lib/components/app/error-state.svelte';
	import ListSkeleton from '$lib/components/app/list-skeleton.svelte';
	import { Card, CardContent } from '$lib/components/ui/card/index.js';
	import { grievanceService } from '$lib/services';
	import { getSession } from '$lib/stores/auth.svelte';
	import type { Grievance } from '$lib/types';
	import PlusIcon from '@lucide/svelte/icons/plus';

	let grievances = $state<Grievance[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

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

<svelte:head><title>My grievances · HostelGrievance</title></svelte:head>

<PageHeader title="My grievances" description="All grievances you have filed.">
	{#snippet actions()}
		<Button href="/student/grievances/new">
			<PlusIcon class="size-4" />
			New grievance
		</Button>
	{/snippet}
</PageHeader>

{#if loading}
	<ListSkeleton rows={5} />
{:else if error}
	<ErrorState message={error} onRetry={load} />
{:else if grievances.length === 0}
	<EmptyState
		title="No grievances filed"
		description="You have not filed any grievances yet. Use the button above to create your first one."
	/>
{:else}
	<Card>
		<CardContent class="px-0">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>ID</TableHead>
						<TableHead>Title</TableHead>
						<TableHead>Category</TableHead>
						<TableHead>Status</TableHead>
						<TableHead>Created</TableHead>
						<TableHead>Last updated</TableHead>
						<TableHead class="text-right"><span class="sr-only">Actions</span></TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each grievances as g (g.id)}
						<TableRow>
							<TableCell class="text-muted-foreground font-mono text-xs">{g.id}</TableCell>
							<TableCell class="max-w-64 truncate font-medium">
								<a href="/student/grievances/{g.id}" class="hover:underline">{g.title}</a>
							</TableCell>
							<TableCell>{g.category}</TableCell>
							<TableCell><StatusBadge status={g.status} /></TableCell>
							<TableCell class="text-muted-foreground whitespace-nowrap">{formatDate(g.createdAt)}</TableCell>
							<TableCell class="text-muted-foreground whitespace-nowrap">{formatDate(g.updatedAt)}</TableCell>
							<TableCell class="text-right">
								<Button variant="outline" size="sm" href="/student/grievances/{g.id}">Open</Button>
							</TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		</CardContent>
	</Card>
{/if}
