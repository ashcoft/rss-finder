import { describe, expect, it } from 'vitest';
import { assertFetchableUrl, isBlockedHost, BlockedUrlError } from './urlGuard.js';

describe('isBlockedHost', () => {
	it.each([
		'localhost',
		'api.localhost',
		'metadata.google.internal',
		'router.local',
		'127.0.0.1',
		'10.1.2.3',
		'172.16.0.1',
		'192.168.1.1',
		'169.254.169.254',
		'100.64.0.1',
		'0.0.0.0',
		'224.0.0.1',
		'2130706433',
		'::1',
		'fd00::1',
		'fe80::1',
		'::ffff:127.0.0.1'
	])('blocks %s', (host) => {
		expect(isBlockedHost(host)).toBe(true);
	});

	it.each(['example.com', 'feeds.bbci.co.uk', '8.8.8.8', '172.32.0.1', '2606:4700::1111'])(
		'allows %s',
		(host) => {
			expect(isBlockedHost(host)).toBe(false);
		}
	);
});

describe('assertFetchableUrl', () => {
	it('returns the parsed URL for a public http(s) URL', () => {
		expect(assertFetchableUrl('https://example.com/feed.xml').hostname).toBe('example.com');
	});

	it('resolves a relative redirect against its base', () => {
		expect(assertFetchableUrl('/blog/feed.xml', 'https://example.com/feed.xml').toString()).toBe(
			'https://example.com/blog/feed.xml'
		);
	});

	it('rejects a non-http scheme', () => {
		expect(() => assertFetchableUrl('file:///etc/passwd')).toThrow(BlockedUrlError);
	});

	it('rejects a private address', () => {
		expect(() => assertFetchableUrl('http://192.168.0.10/feed.xml')).toThrow(
			'Feed URL host is not allowed'
		);
	});

	it('rejects an unparsable URL', () => {
		expect(() => assertFetchableUrl('https://')).toThrow(BlockedUrlError);
	});
});
