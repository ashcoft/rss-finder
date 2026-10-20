import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { GET } from './+server.js';

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Preview Blog</title>
  <link>https://example.com</link>
  <item><title>Post One</title><link>https://example.com/1</link></item>
</channel></rss>`;

function makeEvent(feedUrl?: string): RequestEvent {
	const search = feedUrl === undefined ? '' : `?url=${encodeURIComponent(feedUrl)}`;
	return { url: new URL(`http://localhost/api/feed-preview${search}`) } as RequestEvent;
}

function mockFetchResponse(body: string, init: ResponseInit = {}) {
	const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status: 200, ...init }));
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

describe('GET /api/feed-preview', () => {
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('returns a parsed feed for a valid URL', async () => {
		const fetchMock = mockFetchResponse(RSS);

		const response = await GET(makeEvent('https://example.com/feed.xml'));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.feed.title).toBe('Preview Blog');
		expect(body.feed.items).toHaveLength(1);
		expect(body.feed.items[0].title).toBe('Post One');
		expect(fetchMock).toHaveBeenCalledWith(
			'https://example.com/feed.xml',
			expect.objectContaining({
				headers: expect.objectContaining({ 'User-Agent': 'rss-finder/2.0' }),
				redirect: 'follow'
			})
		);
	});

	it('returns 400 when the url parameter is missing', async () => {
		const response = await GET(makeEvent());

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({ error: 'Feed URL is required' });
	});

	it('returns 400 for a non-http scheme', async () => {
		const response = await GET(makeEvent('ftp://example.com/feed.xml'));

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: 'Feed URL must start with http:// or https://'
		});
	});

	it('returns 400 for a malformed URL', async () => {
		const response = await GET(makeEvent('https://'));

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({ error: 'Invalid feed URL' });
	});

	it('returns 502 when the upstream fetch fails', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(new Response('nope', { status: 404, statusText: 'Not Found' }))
		);

		const response = await GET(makeEvent('https://example.com/missing.xml'));

		expect(response.status).toBe(502);
		await expect(response.json()).resolves.toEqual({
			error: 'Failed to fetch feed (404)'
		});
	});

	it('returns 502 when the response is not a valid feed', async () => {
		mockFetchResponse('<html><body>not a feed</body></html>');

		const response = await GET(makeEvent('https://example.com/page.html'));

		expect(response.status).toBe(502);
		await expect(response.json()).resolves.toEqual({
			error: 'Not a valid RSS or Atom feed'
		});
	});

	it('returns 502 when the network request rejects', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

		const response = await GET(makeEvent('https://example.com/feed.xml'));

		expect(response.status).toBe(502);
		await expect(response.json()).resolves.toEqual({ error: 'network down' });
	});
});
