<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import PaperclipIcon from '@lucide/svelte/icons/paperclip';
	import XIcon from '@lucide/svelte/icons/x';
	import type { AttachmentInput } from '$lib/services/types';

	let {
		selected = null,
		onSelect,
		onRemove,
		disabled = false
	}: {
		selected: AttachmentInput | null;
		onSelect: (file: File) => void;
		onRemove: () => void;
		disabled?: boolean;
	} = $props();

	let inputEl: HTMLInputElement | null = $state(null);
	// Force re-render of the input value after remove so re-selecting the same file works.
	let inputKey = $state(0);

	function formatSize(bytes: number): string {
		if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
		if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
		return `${bytes} B`;
	}

	function handleChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) onSelect(file);
	}

	function handleRemove() {
		onRemove();
		if (inputEl) inputEl.value = '';
		inputKey += 1;
	}
</script>

<div class="space-y-2">
	<Label for="attachment-input">Attachment (optional)</Label>
	{#if selected}
		<div
			class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
			data-testid="attachment-selected"
		>
			<div class="flex min-w-0 items-center gap-2">
				<PaperclipIcon class="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
				<div class="min-w-0">
					<p class="truncate text-sm font-medium">{selected.filename}</p>
					<p class="text-muted-foreground text-xs">{formatSize(selected.sizeBytes)}</p>
				</div>
			</div>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				onclick={handleRemove}
				disabled={disabled}
				aria-label="Remove selected attachment"
			>
				<XIcon class="size-4" />
				<span class="sr-only">Remove</span>
			</Button>
		</div>
	{:else}
		<Card class="border-muted-foreground/25 py-3 border-dashed">
			<CardContent class="flex flex-wrap items-center justify-between gap-3 px-3">
				<p class="text-muted-foreground text-sm">Optional image, up to 2 MB (JPEG, PNG, GIF, or WebP).</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onclick={() => inputEl?.click()}
					disabled={disabled}
				>
					Select file
				</Button>
			</CardContent>
		</Card>
		<input
			bind:this={inputEl}
			id="attachment-input"
			type="file"
			class="sr-only"
			accept="image/jpeg,image/png,image/gif,image/webp"
			onchange={handleChange}
		/>
	{/if}
</div>
