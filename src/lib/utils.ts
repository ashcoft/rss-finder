export function normalizeUrl(url: string): string {
	if (!url?.trim()) {
		throw new Error('URL is required');
	}

	const normalizedUrl = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;

	try {
		new URL(normalizedUrl);
		return normalizedUrl;
	} catch {
		throw new Error('Invalid URL format');
	}
}

export function encodeFeedUrl(url: string): string {
	return btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeFeedUrl(encoded: string): string {
	const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
	const padding = base64.length % 4;
	const padded = padding ? base64 + '='.repeat(4 - padding) : base64;
	return atob(padded);
}
