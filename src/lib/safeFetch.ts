import { assertFetchableUrl } from './urlGuard.js';

const MAX_REDIRECTS = 5;

// `feedfinder-ts` calls the global fetch and follows redirects itself, so discovery is run
// with a guarded wrapper installed for its duration.
let originalFetch: typeof fetch | null = null;
let guardDepth = 0;

/** Fetch that checks the destination of the request and of every redirect hop. */
export async function guardedFetch(
	input: RequestInfo | URL,
	init?: RequestInit,
	baseFetch: typeof fetch = globalThis.fetch
): Promise<Response> {
	let current =
		typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

	// A Request carries its method, headers and abort signal; keep them across hops.
	const requestInit: RequestInit =
		input instanceof Request
			? {
					method: input.method,
					headers: input.headers,
					signal: input.signal,
					mode: input.mode,
					credentials: input.credentials,
					...(init ?? {})
				}
			: { ...init };

	assertFetchableUrl(current);

	// A caller that asked for manual redirects is driving the loop itself (the preview
	// route), so guard the destination and hand the response straight back.
	if (init?.redirect === 'manual') {
		return baseFetch(current, requestInit);
	}

	for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
		assertFetchableUrl(current);

		const response = await baseFetch(current, { ...requestInit, redirect: 'manual' });

		if (response.status >= 300 && response.status < 400) {
			// Release the redirect response so its body cannot hold the connection open.
			try {
				await response.body?.cancel();
			} catch {
				// An already-errored stream needs no cleanup.
			}
			const location = response.headers.get('location');
			if (!location) return response;
			current = assertFetchableUrl(location, current).toString();
			continue;
		}

		return response;
	}

	throw new Error('Too many redirects');
}

const guardWrapper: typeof fetch = (input, init) =>
	guardedFetch(input, init, originalFetch ?? globalThis.fetch);

/** Run `task` with `globalThis.fetch` guarded, restoring it afterwards. */
export async function withGuardedFetch<T>(task: () => Promise<T>): Promise<T> {
	if (guardDepth === 0) {
		originalFetch = globalThis.fetch;
		globalThis.fetch = guardWrapper;
	}
	guardDepth += 1;

	try {
		return await task();
	} finally {
		guardDepth -= 1;
		if (guardDepth === 0 && originalFetch) {
			globalThis.fetch = originalFetch;
			originalFetch = null;
		}
	}
}
