<script lang="ts">
	import type { Comment } from '$lib/types';
	import { Separator } from '$lib/components/ui/separator/index.js';

	let { comments }: { comments: Comment[] } = $props();

	function initials(name: string): string {
		return name
			.split(' ')
			.map((p) => p[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}

	function formatTimestamp(iso: string): string {
		return new Date(iso).toLocaleString('en-IN', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

{#if comments.length === 0}
	<p class="text-muted-foreground text-sm">No comments yet.</p>
{:else}
	<ol class="space-y-0" aria-label="Comment timeline">
		{#each comments as comment, i (comment.id)}
			<li class="flex gap-3">
				<div class="flex flex-col items-center">
					<span
						class="bg-secondary text-secondary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium"
						aria-hidden="true"
					>
						{initials(comment.author.name)}
					</span>
					{#if i < comments.length - 1}
						<Separator orientation="vertical" class="my-1 h-full min-h-6" />
					{/if}
				</div>
				<div class="min-w-0 flex-1 pb-6">
					<div class="flex flex-wrap items-baseline gap-x-2">
						<span class="text-sm font-medium">{comment.author.name}</span>
						<span class="text-muted-foreground text-xs capitalize">{comment.author.role}</span>
						<span class="text-muted-foreground text-xs">· {formatTimestamp(comment.createdAt)}</span>
					</div>
						<p class="mt-1 text-sm whitespace-pre-line">{@html comment.body}</p>
				</div>
			</li>
		{/each}
	</ol>
{/if}
