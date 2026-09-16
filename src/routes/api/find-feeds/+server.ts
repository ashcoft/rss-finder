import { json } from '@sveltejs/kit';
import { find } from 'feedfinder-ts';
import { normalizeUrl } from '$lib/utils.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { url } = await request.json();

		if (!url) {
			return json({ error: 'URL is required' }, { status: 400 });
		}

		let normalizedUrl: string;
		try {
			normalizedUrl = normalizeUrl(url);
		} catch (error) {
			return json({ error: (error as Error).message }, { status: 400 });
		}

		const feeds = await find(normalizedUrl, {
			userAgent: 'rss-finder/2.0'
		});

		// If nothing was found, check whether the site blocked us (bot protection
		// like Cloudflare returns 403/429 with a page that has no feed links), so
		// we can give a clear error instead of "no feeds found"
		if (!feeds || feeds.length === 0) {
			try {
				const probe = await fetch(normalizedUrl, {
					headers: {
						Accept: 'text/html,application/xhtml+xml,*/*',
						'User-Agent': 'rss-finder/2.0'
					},
					redirect: 'follow',
					signal: AbortSignal.timeout(15000)
				});

				if (probe.status === 401 || probe.status === 403 || probe.status === 429) {
					return json(
						{
							error: `The website blocked our request (HTTP ${probe.status}) — it likely uses bot protection, so feeds cannot be detected automatically. Try opening the site in a browser and looking for an RSS/Feed link.`
						},
						{ status: 502 }
					);
				}
			} catch {
				// Probe failures are ignored — the find() result stands
			}
		}

		return json({ feeds });
	} catch (error) {
		console.error('Error finding RSS feeds:', error);
		return json({ error: 'Failed to find RSS feeds' }, { status: 500 });
	}
};
