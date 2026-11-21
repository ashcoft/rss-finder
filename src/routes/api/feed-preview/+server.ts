import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseFeedXml } from '#lib/feedParser.js';
import { assertFetchableUrl, BlockedUrlError } from '#lib/urlGuard.js';

const USER_AGENT = 'rss-finder/2.0';
const TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 5;

async function fetchFeedText(url: string): Promise<{ xml: string; url: string }> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

	try {
		let current = url;

		// Redirects are followed by hand so every hop goes through the host guard, and so
		// relative item links and images resolve against the URL that served the feed.
		for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
			assertFetchableUrl(current);

			const response = await fetch(current, {
				headers: {
					Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
					'User-Agent': USER_AGENT
				},
				signal: controller.signal,
				redirect: 'manual'
			});

			if (response.status >= 300 && response.status < 400) {
				const location = response.headers.get('location');
				if (!location) {
					throw new Error(`Failed to fetch feed (${response.status})`);
				}
				current = assertFetchableUrl(location, current).toString();
				continue;
			}

			if (!response.ok) {
				throw new Error(`Failed to fetch feed (${response.status})`);
			}

			return { xml: await response.text(), url: current };
		}

		throw new Error('Too many redirects');
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
		assertFetchableUrl(feedUrl);
	} catch (error) {
		if (error instanceof BlockedUrlError) {
			return json({ error: error.message }, { status: 400 });
		}
		return json({ error: 'Invalid feed URL' }, { status: 400 });
	}

	try {
		const { xml, url: baseUrl } = await fetchFeedText(feedUrl);
		const feed = parseFeedXml(xml, baseUrl);
		return json({ feed });
	} catch (error) {
		if (error instanceof BlockedUrlError) {
			return json({ error: error.message }, { status: 400 });
		}
		console.error('Error fetching feed preview:', error);
		return json(
			{ error: (error as Error).message || 'Failed to load feed preview' },
			{ status: 502 }
		);
	}
};
