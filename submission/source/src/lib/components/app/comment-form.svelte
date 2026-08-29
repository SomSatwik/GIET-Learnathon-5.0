<script lang="ts">
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';

	let {
		onSubmit,
		disabled = false,
		submitting = false
	}: {
		onSubmit: (body: string) => Promise<boolean>;
		disabled?: boolean;
		submitting?: boolean;
	} = $props();

	let body = $state('');
	let error = $state<string | null>(null);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = body.trim();
		if (!trimmed) {
			error = 'Comment cannot be empty.';
			return;
		}
		error = null;
		const ok = await onSubmit(trimmed);
		if (ok) {
			body = '';
		} else {
			error = 'Could not add the comment. Please try again.';
		}
	}
</script>

<form onsubmit={handleSubmit} class="space-y-2" aria-label="Add a comment">
	<div class="space-y-1.5">
		<Label for="comment-body">Add a comment</Label>
		<Textarea
			id="comment-body"
			placeholder="Write an update…"
			rows={3}
			bind:value={body}
			aria-invalid={error ? 'true' : undefined}
			disabled={disabled || submitting}
		/>
		{#if error}
			<p class="text-destructive text-sm" role="alert">{error}</p>
		{/if}
	</div>
	<div class="flex justify-end">
		<Button type="submit" size="sm" disabled={disabled || submitting}>
			{submitting ? 'Posting…' : 'Post comment'}
		</Button>
	</div>
</form>
