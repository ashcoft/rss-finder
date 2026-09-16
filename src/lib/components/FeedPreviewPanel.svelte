<script lang="ts">
	import type { ParsedFeed } from '$lib/feedParser.js';
	import { encodeFeedUrl } from '$lib/utils.js';

	interface Props {
		feedUrl: string | null;
		onclose: () => void;
	}

	let { feedUrl, onclose }: Props = $props();

	let isLoading = $state(false);
	let feed = $state<ParsedFeed | null>(null);
	let error = $state('');
	let copied = $state(false);
	let showAll = $state(false);
	let closeButton: HTMLButtonElement | null = $state(null);

	const VISIBLE_ITEMS = 20;

	// Keep the panel mounted so it can animate out; `open` drives the animation
	let open = $derived(feedUrl !== null);

	async function loadPreview(url: string) {
		isLoading = true;
		error = '';
		feed = null;

		try {
			const response = await fetch(`/api/feed-preview?url=${encodeURIComponent(url)}`);
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to load feed preview');
			}

			feed = data.feed || null;
		} catch (err) {
			error = (err as Error).message;
		} finally {
			isLoading = false;
		}
	}

	async function copyToClipboard(url: string) {
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy: ', err);
		}
	}

	function formatDate(date: string): string {
		const parsed = new Date(date);
		if (isNaN(parsed.getTime())) return date;
		return parsed.toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	$effect(() => {
		if (feedUrl) {
			showAll = false;
			void loadPreview(feedUrl);
		}
	});

	$effect(() => {
		if (open) {
			document.body.style.overflow = 'hidden';
			closeButton?.focus();
		} else {
			document.body.style.overflow = '';
		}
	});

	const visibleItems = $derived(
		feed ? (showAll ? feed.items : feed.items.slice(0, VISIBLE_ITEMS)) : []
	);
</script>

<!-- Backdrop -->
<button
	type="button"
	class="fixed inset-0 z-40 cursor-default bg-black/40 transition-opacity duration-300 {open
		? 'opacity-100'
		: 'pointer-events-none opacity-0'}"
	onclick={onclose}
	aria-label="Close feed preview"
	tabindex="-1"
></button>

<!-- Slide-in side panel -->
<div
	class="fixed top-0 right-0 z-50 flex h-dvh w-full max-w-md flex-col border-l border-border bg-white shadow-xl transition-transform duration-300 ease-out {open
		? 'translate-x-0'
		: 'translate-x-full'}"
	role="dialog"
	aria-modal="true"
	aria-label="Feed preview"
>
	<header class="flex items-center justify-between gap-3 border-b border-border p-4">
		<div class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
			Feed preview
		</div>
		<button
			bind:this={closeButton}
			type="button"
			class="hover:text-foreground rounded p-1.5 text-muted-foreground hover:bg-muted"
			onclick={onclose}
			aria-label="Close preview"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				aria-hidden="true"
			>
				<path d="M18 6 6 18" /><path d="m6 6 12 12" />
			</svg>
		</button>
	</header>

	<div class="flex-1 overflow-y-auto p-4">
		{#if isLoading}
			<div class="flex flex-col gap-4" role="status" aria-live="polite">
				{#each [0, 1, 2, 3] as skeleton (skeleton)}
					<div class="flex flex-col gap-2 rounded-lg border border-border bg-white p-4">
						<div
							class="h-5 animate-pulse rounded bg-gradient-to-r from-border via-muted to-border bg-[length:200%_100%]"
							style="width: {skeleton % 2 ? '62%' : '78%'}"
						></div>
						<div
							class="h-4 animate-pulse rounded bg-gradient-to-r from-border via-muted to-border bg-[length:200%_100%]"
							style="width: {skeleton % 2 ? '45%' : '55%'}"
						></div>
					</div>
				{/each}
			</div>
		{:else if error}
			<div
				class="rounded-lg border border-destructive bg-destructive/5 px-3 py-2.5 text-center text-xs text-destructive sm:text-sm"
				role="alert"
			>
				Error: {error}
			</div>
		{:else if feed}
			<div class="mb-4">
				<h2 class="text-lg font-medium">{feed.title}</h2>
				{#if feed.description}
					<p class="mt-1 text-xs text-muted-foreground sm:text-sm">{feed.description}</p>
				{/if}
				<div class="mt-2 flex flex-wrap items-center gap-2">
					<a
						href={feedUrl ?? '#'}
						target="_blank"
						rel="noopener noreferrer"
						class="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover"
					>
						Open feed
					</a>
					<button
						type="button"
						class="rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
						onclick={() => copyToClipboard(feedUrl ?? '')}
						aria-label="Copy feed URL"
					>
						Copy URL
					</button>
					<a
						href="/preview/{encodeFeedUrl(feedUrl ?? '')}"
						class="rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
					>
						Full page
					</a>
				</div>
			</div>
			{#if feed.items.length === 0}
				<div
					class="rounded-lg border border-border bg-white px-3 py-6 text-center text-sm text-muted-foreground"
				>
					No items found in this feed.
				</div>
			{:else}
				<div class="flex flex-col gap-3">
					<h3 class="text-sm font-medium text-muted-foreground">
						{feed.items.length} item{feed.items.length !== 1 ? 's' : ''}
					</h3>
					{#each visibleItems as item, index (index)}
						<article
							class="flex flex-col gap-2 rounded-lg border border-border bg-white p-3 hover:border-primary"
						>
							{#if item.link}
								<a
									href={item.link}
									target="_blank"
									rel="noopener noreferrer"
									class="text-sm font-medium hover:text-primary"
								>
									{item.title}
								</a>
							{:else}
								<span class="text-sm font-medium">{item.title}</span>
							{/if}
							{#if item.pubDate}
								<div class="text-xs text-muted-foreground">
									<time datetime={item.pubDate}>{formatDate(item.pubDate)}</time>
								</div>
							{/if}
							{#if item.description}
								<p class="line-clamp-2 text-xs text-muted-foreground sm:text-sm">
									{item.description}
								</p>
							{/if}
						</article>
					{/each}

					{#if !showAll && feed.items.length > VISIBLE_ITEMS}
						<button
							type="button"
							class="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
							onclick={() => (showAll = true)}
						>
							Show all {feed.items.length} items
						</button>
					{/if}
				</div>
			{/if}
		{/if}
	</div>

	{#if copied}
		<div
			class="success-message fixed top-4 right-4 z-50 rounded bg-black px-3 py-2 text-xs text-white sm:text-sm"
		>
			Copied to clipboard!
		</div>
	{/if}
</div>
