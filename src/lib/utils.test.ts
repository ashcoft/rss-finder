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
});
