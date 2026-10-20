export function normalizeUrl(url: string): string {
	if (!url?.trim()) {
		throw new Error('URL is required');
	}

	const trimmed = url.trim();
	// A scheme is `scheme:` not followed by a digit, so `example.com:8080` is read as
	// host:port rather than as the scheme `example.com`. Only http(s) is accepted, so a
	// bare host gets https:// and anything like `mailto:`/`ftp:` is rejected.
	const scheme = /^([a-z][a-z0-9+.-]*):(?!\d)/i.exec(trimmed)?.[1]?.toLowerCase();
	const candidate = scheme ? trimmed : `https://${trimmed}`;

	let parsed: URL;
	try {
		parsed = new URL(candidate);
	} catch {
		throw new Error('Invalid URL format');
	}

	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		throw new Error('Invalid URL format');
	}

	return candidate;
}

export function encodeFeedUrl(url: string): string {
	// btoa only accepts Latin-1, so encode to UTF-8 bytes first to support IDN/punycode and
	// non-ASCII paths. ASCII input still produces byte-identical output to a plain btoa().
	let binary = '';
	for (const byte of new TextEncoder().encode(url)) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeFeedUrl(encoded: string): string {
	const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
	const padding = base64.length % 4;
	const padded = padding ? base64 + '='.repeat(4 - padding) : base64;
	const binary = atob(padded);
	const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

	// Links created before UTF-8 encoding was introduced hold raw Latin-1 bytes, which
	// strict UTF-8 decoding rejects. Fall back to the legacy byte-per-character string so
	// those older share links keep resolving to the same feed.
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		return binary;
	}
}
