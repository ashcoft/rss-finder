import { describe, expect, it } from 'vitest';
import { encodeFeedUrl } from '$lib/utils.js';
import { load } from './+page.js';

type LoadEvent = Parameters<typeof load>[0];

function makeEvent(feed: string): LoadEvent {
	return { params: { feed } } as LoadEvent;
}

describe('preview/[feed] load', () => {
	it('decodes a valid encoded feed URL', () => {
		const feedUrl = 'https://example.com/feed.xml';

		expect(load(makeEvent(encodeFeedUrl(feedUrl)))).toEqual({ feedUrl });
	});

	it('throws a 400 for an undecodable feed param', () => {
		expect(() => load(makeEvent('!not-base64!'))).toThrowError(
			expect.objectContaining({ status: 400, body: { message: 'Invalid feed link' } })
		);
	});

	it('throws a 400 for a decoded non-http URL', () => {
		expect(() => load(makeEvent(encodeFeedUrl('ftp://example.com/feed')))).toThrowError(
			expect.objectContaining({ status: 400, body: { message: 'Invalid feed URL' } })
		);
	});

	it('rejects a javascript: payload rather than passing it through', () => {
		expect(() => load(makeEvent(encodeFeedUrl('javascript:alert(1)')))).toThrowError(
			expect.objectContaining({ status: 400 })
		);
	});
});
