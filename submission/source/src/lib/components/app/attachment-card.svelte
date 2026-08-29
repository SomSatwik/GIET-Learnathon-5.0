<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card/index.js';
	import type { Attachment } from '$lib/types';
	import FileIcon from '@lucide/svelte/icons/file';

	let { attachment }: { attachment: Attachment } = $props();

	function formatSize(bytes: number): string {
		if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
		if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
		return `${bytes} B`;
	}
</script>

<Card class="py-3">
	<CardContent class="flex items-center gap-3 px-3">
		<span
			class="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md"
			aria-hidden="true"
		>
			<FileIcon class="size-4" />
		</span>
		<div class="min-w-0">
			<p class="truncate text-sm font-medium">
				<a
					class="hover:underline"
					href="/api/attachments/{attachment.id}"
					target="_blank"
					rel="noreferrer"
				>
					{attachment.filename}
				</a>
			</p>
			<p class="text-muted-foreground text-xs">
				{formatSize(attachment.sizeBytes)} · {attachment.contentType}
			</p>
		</div>
	</CardContent>
</Card>
