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
				redirect: 'manual'
			})
		);
	});

	it('resolves relative item links and images against the final URL after a redirect', async () => {
		const feed = `<rss version="2.0"><channel><title>Moved</title>
  <item><title>P</title><link>post/1</link>
    <description><![CDATA[<img src="images/a.jpg"/>]]></description></item>
</channel></rss>`;
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(null, {
					status: 301,
					headers: { location: 'https://example.com/blog/feed.xml' }
				})
			)
			.mockResolvedValueOnce(new Response(feed, { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		const res = await GET(makeEvent('https://example.com/feed.xml'));
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			'https://example.com/blog/feed.xml',
			expect.objectContaining({ redirect: 'manual' })
		);
		expect(body.feed.items[0].link).toBe('https://example.com/blog/post/1');
		expect(body.feed.items[0].image).toBe('https://example.com/blog/images/a.jpg');
	});

	it('rejects a redirect to a private address', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(null, {
					status: 302,
					headers: { location: 'http://169.254.169.254/latest/meta-data/' }
				})
			)
		);

		const res = await GET(makeEvent('https://example.com/feed.xml'));

		expect(res.status).toBe(400);
		await expect(res.json()).resolves.toEqual({ error: 'Feed URL host is not allowed' });
	});

	it('rejects a feed URL that points at a private address', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		const res = await GET(makeEvent('http://127.0.0.1/feed.xml'));

		expect(res.status).toBe(400);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('rejects a feed URL on a local hostname', async () => {
		const res = await GET(makeEvent('http://localhost:8080/feed.xml'));

		expect(res.status).toBe(400);
		await expect(res.json()).resolves.toEqual({ error: 'Feed URL host is not allowed' });
	});

	it('stops after too many redirects', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(
					new Response(null, { status: 302, headers: { location: 'https://example.com/loop.xml' } })
				)
		);

		const res = await GET(makeEvent('https://example.com/feed.xml'));

		expect(res.status).toBe(502);
		await expect(res.json()).resolves.toEqual({ error: 'Too many redirects' });
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
