<script lang="ts">
	import type { ParsedFeed } from '$lib/feedParser.js';

	let { data } = $props();

	const feedUrl = data.feedUrl;

	let isLoading = $state(true);
	let feed = $state<ParsedFeed | null>(null);
	let error = $state('');
	let copied = $state(false);
	let showAll = $state(false);

	const VISIBLE_ITEMS = 20;

	async function loadPreview() {
		isLoading = true;
		error = '';
		feed = null;

		try {
			const response = await fetch(`/api/feed-preview?url=${encodeURIComponent(feedUrl)}`);
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
			loadPreview();
		}
	});

	const visibleItems = $derived(
		feed ? (showAll ? feed.items : feed.items.slice(0, VISIBLE_ITEMS)) : []
	);
</script>

<svelte:head>
	<title>Feed Preview - RSS Finder</title>
	<meta name="description" content="Preview the latest items in an RSS feed." />
</svelte:head>

<main class="mx-auto flex min-h-screen max-w-4xl flex-col px-4 sm:px-6 lg:px-8">
	<section class="flex w-full flex-1 flex-col justify-start pt-16 sm:pt-20">
		<a
			href="/"
			class="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
		>
			<span aria-hidden="true">&larr;</span> Back to search
		</a>

		{#if isLoading}
			<div class="flex flex-col gap-4" role="status" aria-live="polite">
				<div class="flex items-center rounded-2xl border border-border bg-white p-7">
					<div
						class="mr-4 h-5 flex-1 animate-pulse rounded bg-gradient-to-r from-border via-muted to-border bg-[length:200%_100%]"
					></div>
				</div>
				<div class="flex items-center rounded-2xl border border-border bg-white p-7">
					<div
						class="mr-4 h-5 flex-1 animate-pulse rounded bg-gradient-to-r from-border via-muted to-border bg-[length:200%_100%]"
					></div>
				</div>
				<div class="flex items-center rounded-2xl border border-border bg-white p-7">
					<div
						class="mr-4 h-5 flex-1 animate-pulse rounded bg-gradient-to-r from-border via-muted to-border bg-[length:200%_100%]"
					></div>
				</div>
			</div>
		{:else if error}
			<div
				class="rounded-lg border border-destructive bg-destructive/5 px-3 py-2.5 text-center text-xs text-destructive sm:px-4 sm:py-3 sm:text-sm"
				role="alert"
			>
				Error: {error}
			</div>
		{:else if feed}
			<header
				class="mb-6 flex flex-col gap-4 rounded-2xl border border-border bg-white p-5 sm:flex-row sm:items-center sm:p-6"
			>
				<div class="flex-1">
					<div class="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
						Feed preview
					</div>
					<h1 class="text-xl font-medium sm:text-2xl">{feed.title}</h1>
					{#if feed.link}
						<a
							href={feed.link}
							target="_blank"
							rel="noopener noreferrer"
							class="mt-1 block text-xs break-all text-muted-foreground hover:text-primary sm:text-sm"
						>
							{feedUrl}
						</a>
					{:else}
						<div class="mt-1 block text-xs break-all text-muted-foreground sm:text-sm">
							{feedUrl}
						</div>
					{/if}
					{#if feed.description}
						<p class="mt-2 text-xs text-muted-foreground sm:text-sm">{feed.description}</p>
					{/if}
				</div>
				<div class="flex flex-wrap gap-2">
					<a
						href={feedUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="min-h-[44px] rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover sm:min-h-0 sm:px-3 sm:py-1.5"
					>
						Open feed
					</a>
					<button
						class="min-h-[44px] rounded border border-border px-4 py-2 text-sm font-medium hover:bg-muted sm:min-h-0 sm:px-3 sm:py-1.5"
						onclick={() => copyToClipboard(feedUrl)}
						aria-label="Copy feed URL"
					>
						Copy URL
					</button>
				</div>
			</header>

			{#if feed.items.length === 0}
				<div
					class="rounded-lg border border-border bg-white px-3 py-6 text-center text-sm text-muted-foreground"
				>
					No items found in this feed.
				</div>
			{:else}
				<div class="flex flex-col gap-3">
					<h2 class="mb-1 text-sm font-medium text-muted-foreground sm:text-base">
						{feed.items.length} item{feed.items.length !== 1 ? 's' : ''}
					</h2>
					{#each visibleItems as item, index (index)}
						<article
							class="flex flex-col gap-2 rounded-lg border border-border bg-white p-3 hover:border-primary sm:p-4"
						>
							{#if item.link}
								<a
									href={item.link}
									target="_blank"
									rel="noopener noreferrer"
									class="text-sm font-medium hover:text-primary sm:text-base"
								>
									{item.title}
								</a>
							{:else}
								<span class="text-sm font-medium sm:text-base">{item.title}</span>
							{/if}
							<div
								class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
							>
								{#if item.pubDate}
									<time datetime={item.pubDate}>{formatDate(item.pubDate)}</time>
								{/if}
								{#if item.link}
									<span class="break-all">{item.link}</span>
								{/if}
							</div>
							{#if item.description}
								<p class="line-clamp-2 text-xs text-muted-foreground sm:text-sm">
									{item.description}
								</p>
							{/if}
						</article>
					{/each}

					{#if !showAll && feed.items.length > VISIBLE_ITEMS}
						<button
							class="min-h-[44px] rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted sm:min-h-0 sm:py-2"
							onclick={() => (showAll = true)}
						>
							Show all {feed.items.length} items
						</button>
					{/if}
				</div>
			{/if}

			{#if copied}
				<div
					class="success-message fixed top-4 right-4 z-50 rounded bg-black px-3 py-2 text-xs text-white sm:text-sm"
				>
					Copied to clipboard!
				</div>
			{/if}
		{/if}
	</section>

	<footer class="py-8 text-center">
		<a
			href="https://github.com/0x2E/rss-finder"
			target="_blank"
			rel="noopener noreferrer"
			class="text-sm text-muted-foreground hover:text-primary"
		>
			GitHub Project
		</a>
	</footer>
</main>
