import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseFeedXml } from '$lib/feedParser.js';

const USER_AGENT = 'rss-finder/2.0';
const TIMEOUT_MS = 15000;

async function fetchFeedText(url: string): Promise<string> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		const response = await fetch(url, {
			headers: {
				Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
				'User-Agent': USER_AGENT
			},
			signal: controller.signal,
			redirect: 'follow'
		});
		if (!response.ok) {
			throw new Error(`Failed to fetch feed (${response.status})`);
		}
		return await response.text();
	} finally {
		clearTimeout(timeout);
	}
}

export const GET: RequestHandler = async ({ url }) => {
	const feedUrl = url.searchParams.get('url');

	if (!feedUrl) {
		return json({ error: 'Feed URL is required' }, { status: 400 });
	}

	if (!/^https?:\/\//i.test(feedUrl)) {
		return json({ error: 'Feed URL must start with http:// or https://' }, { status: 400 });
	}

	try {
		const target = new URL(feedUrl);
		// Limit redirect targets to supported schemes to avoid SSRF-ish redirects
		if (!/^https?:$/.test(target.protocol)) {
			return json({ error: 'Invalid feed URL protocol' }, { status: 400 });
		}
	} catch {
		return json({ error: 'Invalid feed URL' }, { status: 400 });
	}

	try {
		const xml = await fetchFeedText(feedUrl);
		const feed = parseFeedXml(xml, feedUrl);
		return json({ feed });
	} catch (error) {
		console.error('Error fetching feed preview:', error);
		return json(
			{ error: (error as Error).message || 'Failed to load feed preview' },
			{ status: 502 }
		);
	}
};
