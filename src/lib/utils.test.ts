import { describe, expect, it } from 'vitest';
import { normalizeUrl } from './utils.js';

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
