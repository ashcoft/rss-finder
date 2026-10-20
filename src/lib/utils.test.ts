import { describe, expect, it } from 'vitest';
import { normalizeUrl, encodeFeedUrl, decodeFeedUrl } from './utils.js';

describe('encodeFeedUrl', () => {
	it('round-trips a feed URL', () => {
		const url = 'https://example.com/feed.xml';
		expect(decodeFeedUrl(encodeFeedUrl(url))).toBe(url);
	});

	it('round-trips a URL containing + / = characters', () => {
		const url = 'https://example.com/a+b/c?d=e&f=/x=';
		expect(decodeFeedUrl(encodeFeedUrl(url))).toBe(url);
	});

	it('produces a URL-safe encoding without = padding', () => {
		const encoded = encodeFeedUrl('https://example.com/feed.xml');
		expect(encoded).not.toMatch(/[+/=]/);
	});

	it('throws for invalid encoded input', () => {
		expect(() => decodeFeedUrl('!not-base64!')).toThrow();
	});

	it('round-trips a URL containing non-ASCII characters', () => {
		const url = 'https://例え.jp/フィード.xml?q=café';
		expect(decodeFeedUrl(encodeFeedUrl(url))).toBe(url);
	});

	it('does not throw for non-Latin1 input (btoa would)', () => {
		expect(() => encodeFeedUrl('https://例え.jp/feed')).not.toThrow();
	});

	it('round-trips an already punycode IDN host', () => {
		const url = 'https://xn--r8jz45g.jp/feed';
		expect(decodeFeedUrl(encodeFeedUrl(url))).toBe(url);
	});

	it('decodes a legacy Latin-1 link created by the pre-UTF-8 encoder', () => {
		// btoa() output for a URL containing a raw Latin-1 byte (é = 0xE9).
		const legacy = btoa('https://example.com/café/feed.xml')
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '');

		expect(decodeFeedUrl(legacy)).toBe('https://example.com/café/feed.xml');
	});
});

describe('normalizeUrl', () => {
	it('prepends https:// when no protocol is provided', () => {
		expect(normalizeUrl('havo.co.id')).toBe('https://havo.co.id');
	});

	it('preserves an existing http:// scheme', () => {
		expect(normalizeUrl('http://example.com')).toBe('http://example.com');
	});

	it('preserves an existing https:// scheme', () => {
		expect(normalizeUrl('https://example.com/feed')).toBe('https://example.com/feed');
	});

	it('trims surrounding whitespace', () => {
		expect(normalizeUrl('  example.com  ')).toBe('https://example.com');
	});

	it('accepts subdomains and paths', () => {
		expect(normalizeUrl('blog.example.com')).toBe('https://blog.example.com');
	});

	it('throws for an empty input', () => {
		expect(() => normalizeUrl('')).toThrow('URL is required');
	});

	it('throws for whitespace-only input', () => {
		expect(() => normalizeUrl('   ')).toThrow('URL is required');
	});

	it('throws for an invalid URL', () => {
		expect(() => normalizeUrl('not a url')).toThrow('Invalid URL format');
	});

	it('throws for a malformed scheme', () => {
		expect(() => normalizeUrl('http://')).toThrow('Invalid URL format');
	});

	it('accepts an upper-case scheme without mangling the URL', () => {
		const normalized = normalizeUrl('HTTP://example.com');
		expect(normalized).not.toContain('https://http');
		expect(new URL(normalized).hostname).toBe('example.com');
	});

	it('accepts a mixed-case https scheme', () => {
		const normalized = normalizeUrl('HtTpS://example.com/feed');
		expect(new URL(normalized).hostname).toBe('example.com');
		expect(new URL(normalized).protocol).toBe('https:');
	});

	it('rejects non-http schemes instead of silently rewriting them', () => {
		expect(() => normalizeUrl('ftp://example.com')).toThrow('Invalid URL format');
		expect(() => normalizeUrl('file:///etc/passwd')).toThrow('Invalid URL format');
	});

	it('does not treat a domain starting with "http" as an existing scheme', () => {
		expect(normalizeUrl('httpbin.org')).toBe('https://httpbin.org');
	});

	it('accepts a scheme without slashes, e.g. http:example.com', () => {
		const normalized = normalizeUrl('http:example.com');
		expect(normalized).toBe('http:example.com');
		expect(new URL(normalized).protocol).toBe('http:');
		expect(new URL(normalized).hostname).toBe('example.com');
	});

	it('accepts an https scheme without slashes', () => {
		const normalized = normalizeUrl('https:example.com');
		expect(new URL(normalized).hostname).toBe('example.com');
	});

	it('rejects non-http schemes that carry no slashes', () => {
		expect(() => normalizeUrl('mailto:user@example.com')).toThrow('Invalid URL format');
		expect(() => normalizeUrl('javascript:alert(1)')).toThrow('Invalid URL format');
	});

	it('treats a host with a port as a host, not as a scheme', () => {
		expect(normalizeUrl('example.com:8080')).toBe('https://example.com:8080');
		expect(normalizeUrl('localhost:3000')).toBe('https://localhost:3000');
		expect(normalizeUrl('example.com:8080/path')).toBe('https://example.com:8080/path');
	});
});
