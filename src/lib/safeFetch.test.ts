import { afterEach, describe, expect, it, vi } from 'vitest';
import { guardedFetch, withGuardedFetch } from './safeFetch.js';
import { BlockedUrlError } from './urlGuard.js';

function mockFetch(...responses: Response[]) {
	const fetchMock = vi.fn();
	for (const response of responses) fetchMock.mockResolvedValueOnce(response);
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

describe('guardedFetch', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('refuses a private destination before connecting', async () => {
		const fetchMock = mockFetch(new Response('ok'));

		await expect(guardedFetch('http://169.254.169.254/latest/meta-data/')).rejects.toBeInstanceOf(
			BlockedUrlError
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('follows a public redirect and checks each hop', async () => {
		const fetchMock = mockFetch(
			new Response(null, { status: 302, headers: { location: 'https://example.com/feed.xml' } }),
			new Response('feed', { status: 200 })
		);

		const response = await guardedFetch('https://example.com/');

		expect(response.status).toBe(200);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			'https://example.com/feed.xml',
			expect.objectContaining({ redirect: 'manual' })
		);
	});

	it('refuses a redirect to a private address', async () => {
		mockFetch(
			new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/feed.xml' } })
		);

		await expect(guardedFetch('https://example.com/')).rejects.toBeInstanceOf(BlockedUrlError);
	});

	it('stops after too many redirects', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(
					new Response(null, { status: 302, headers: { location: 'https://example.com/loop' } })
				)
		);

		await expect(guardedFetch('https://example.com/')).rejects.toThrow('Too many redirects');
	});
});

describe('withGuardedFetch', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('installs the guard for the task and restores fetch afterwards', async () => {
		const original = vi.fn().mockResolvedValue(new Response('ok'));
		vi.stubGlobal('fetch', original);

		const seen = await withGuardedFetch(async () => {
			await expect(fetch('https://127.0.0.1/')).rejects.toBeInstanceOf(BlockedUrlError);
			return 'done';
		});

		expect(seen).toBe('done');
		expect(globalThis.fetch).toBe(original);
		expect(original).not.toHaveBeenCalled();
	});

	it('leaves a caller that asked for manual redirects alone', async () => {
		const fetchMock = mockFetch(
			new Response(null, { status: 302, headers: { location: 'https://example.com/next' } })
		);

		const response = await guardedFetch('https://example.com/feed', { redirect: 'manual' });

		expect(response.status).toBe(302);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
	it('keeps the method and headers of a Request input', async () => {
		const fetchMock = mockFetch(new Response('ok'));

		await guardedFetch(
			new Request('https://example.com/feed', {
				method: 'HEAD',
				headers: { accept: 'application/rss+xml' }
			})
		);

		expect(fetchMock).toHaveBeenCalledWith(
			'https://example.com/feed',
			expect.objectContaining({ method: 'HEAD', redirect: 'manual' })
		);

		const init = fetchMock.mock.calls[0][1] as RequestInit;
		expect(new Headers(init.headers).get('accept')).toBe('application/rss+xml');
	});
	it('sends a request body only on the first hop', async () => {
		const fetchMock = mockFetch(
			new Response(null, { status: 307, headers: { location: 'https://example.com/next' } }),
			new Response('ok', { status: 200 })
		);

		await guardedFetch(
			new Request('https://example.com/feed', { method: 'POST', body: 'payload' })
		);

		const firstInit = fetchMock.mock.calls[0][1] as RequestInit;
		const secondInit = fetchMock.mock.calls[1][1] as RequestInit;

		expect(firstInit.body).toBeDefined();
		expect(secondInit.body).toBeUndefined();
	});
	it('drops credentials when a redirect changes origin', async () => {
		const fetchMock = mockFetch(
			new Response(null, { status: 302, headers: { location: 'https://other.example/feed' } }),
			new Response('ok', { status: 200 })
		);

		await guardedFetch('https://example.com/feed', {
			headers: { authorization: 'Bearer secret' }
		});

		const firstInit = fetchMock.mock.calls[0][1] as RequestInit;
		const secondInit = fetchMock.mock.calls[1][1] as RequestInit;

		expect(new Headers(firstInit.headers).get('authorization')).toBe('Bearer secret');
		expect(new Headers(secondInit.headers).get('authorization')).toBeNull();
	});

	it('prefers an explicit init body over the Request body', async () => {
		const fetchMock = mockFetch(new Response('ok'));

		await guardedFetch(new Request('https://example.com/feed', { method: 'POST', body: 'old' }), {
			body: 'new'
		});

		const init = fetchMock.mock.calls[0][1] as RequestInit;
		expect(init.body).toBe('new');
	});
});
