export function normalizeUrl(url: string): string {
	if (!url?.trim()) {
		throw new Error('URL is required');
	}

	const trimmed = url.trim();
	// Keep a scheme the caller already provided (case-insensitively); otherwise assume https.
	const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

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
	return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}
