export class BlockedUrlError extends Error {}

const BLOCKED_HOSTS = new Set(['localhost', 'metadata', 'metadata.google.internal']);
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa'];

function ipv4Parts(host: string): number[] | null {
	const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
	if (!match) return null;
	const parts = match.slice(1).map(Number);
	return parts.every((part) => part <= 255) ? parts : null;
}

function isPrivateIpv4([a, b]: number[]): boolean {
	return (
		a === 0 ||
		a === 10 ||
		a === 127 ||
		(a === 100 && b >= 64 && b <= 127) ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168) ||
		(a === 192 && b === 0) ||
		(a === 198 && (b === 18 || b === 19)) ||
		a >= 224
	);
}

// URL parsing rewrites `::ffff:127.0.0.1` to the hexadecimal `::ffff:7f00:1`, so both
// spellings have to be unwrapped before the IPv4 range checks run.
function mappedIpv4(host: string): number[] | null {
	const dotted = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(host);
	if (dotted) return ipv4Parts(dotted[1]);

	const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(host);
	if (!hex) return null;

	const high = parseInt(hex[1], 16);
	const low = parseInt(hex[2], 16);
	return [high >> 8, high & 0xff, low >> 8, low & 0xff];
}

function isPrivateIpv6(host: string): boolean {
	const mapped = mappedIpv4(host);
	if (mapped) return isPrivateIpv4(mapped);
	return (
		host === '::' ||
		host === '::1' ||
		/^f[cd][0-9a-f]{2}:/.test(host) ||
		/^fe[89ab][0-9a-f]:/.test(host) ||
		/^fe[c-f][0-9a-f]:/.test(host) || // deprecated site local
		/^ff[0-9a-f]{2}:/.test(host) // multicast
	);
}

export function isBlockedHost(hostname: string): boolean {
	const host = hostname
		.toLowerCase()
		.replace(/\.$/, '')
		.replace(/^\[|\]$/g, '');

	if (BLOCKED_HOSTS.has(host)) return true;
	if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
	// Integer form, e.g. http://2130706433/ for 127.0.0.1.
	if (/^\d+$/.test(host)) return true;

	const ipv4 = ipv4Parts(host);
	if (ipv4) return isPrivateIpv4(ipv4);
	if (host.includes(':')) return isPrivateIpv6(host);

	return false;
}

/**
 * Parses a URL that this server is about to fetch and rejects anything that is not a public
 * http(s) endpoint. Literal private addresses are blocked here; hostnames that resolve to a
 * private address would need a resolver-level check, which the edge runtimes do not expose.
 */
export function assertFetchableUrl(raw: string, base?: string): URL {
	let url: URL;
	try {
		url = new URL(raw, base);
	} catch {
		throw new BlockedUrlError('Invalid feed URL');
	}

	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new BlockedUrlError('Feed URL must use http or https');
	}

	if (isBlockedHost(url.hostname)) {
		throw new BlockedUrlError('Feed URL host is not allowed');
	}

	return url;
}
