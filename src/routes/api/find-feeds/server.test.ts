import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Feed } from 'feedfinder-ts';
import type { RequestEvent } from '@sveltejs/kit';
import { POST } from './+server.js';

vi.mock('feedfinder-ts', () => ({
	find: vi.fn()
}));

import { find } from 'feedfinder-ts';
const mockedFind = vi.mocked(find);

function makeEvent(body: unknown): RequestEvent {
	return {
		request: new Request('http://localhost/api/find-feeds', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as RequestEvent;
}

describe('POST /api/find-feeds', () => {
	beforeEach(() => {
		mockedFind.mockReset();
	});

	it('returns found feeds for a valid URL', async () => {
		const feeds: Feed[] = [{ title: 'Example RSS', link: 'https://example.com/rss' }];
		mockedFind.mockResolvedValue(feeds);

		const response = await POST(makeEvent({ url: 'https://example.com' }));

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ feeds });
		expect(mockedFind).toHaveBeenCalledWith('https://example.com', {
			userAgent: 'rss-finder/2.0'
		});
	});

	it('normalizes a bare domain before searching', async () => {
		mockedFind.mockResolvedValue([]);

		const response = await POST(makeEvent({ url: 'example.com' }));

		expect(mockedFind).toHaveBeenCalledWith('https://example.com', {
			userAgent: 'rss-finder/2.0'
		});
		expect(response.status).toBe(200);
	});

	it('returns 400 when the URL is missing', async () => {
		const response = await POST(makeEvent({}));

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({ error: 'URL is required' });
	});

	it('returns 400 for an invalid URL', async () => {
		const response = await POST(makeEvent({ url: 'not a url' }));

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({ error: 'Invalid URL format' });
	});

	it('returns 500 when feed finding fails', async () => {
		mockedFind.mockRejectedValue(new Error('boom'));

		const response = await POST(makeEvent({ url: 'https://example.com' }));

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({ error: 'Failed to find RSS feeds' });
	});
});
