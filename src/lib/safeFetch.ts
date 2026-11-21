import { assertFetchableUrl } from './urlGuard.js';

const MAX_REDIRECTS = 5;

// `feedfinder-ts` calls the global fetch and follows redirects itself, so discovery is run
// with a guarded wrapper installed for its duration.
let originalFetch: typeof fetch | null = null;
let guardDepth = 0;

const SENSITIVE_HEADERS = ['authorization', 'cookie', 'proxy-authorization'];

// A redirect to another origin must not carry the caller's credentials.
function withoutSensitiveHeaders(init: RequestInit): RequestInit {
	if (!init.headers) return init;

	const headers = new Headers(init.headers);
	for (const name of SENSITIVE_HEADERS) headers.delete(name);
	return { ...init, headers };
}

/** Fetch that checks the destination of the request and of every redirect hop. */
export async function guardedFetch(
	input: RequestInfo | URL,
	init?: RequestInit,
	baseFetch: typeof fetch = globalThis.fetch
): Promise<Response> {
	let current =
		typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

	// A Request carries its method, headers and abort signal; keep them across hops.
	const requestInit: RequestInit & { duplex?: string } =
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

	// A body stream can only be read once, so it rides the first request only. A later hop
	// of a 307/308 keeps the method but cannot resend the body.
	// An explicit init.body wins over the Request's own body.
	const body = init?.body ?? (input instanceof Request ? input.body : null);
	const firstHopInit: RequestInit & { duplex?: string } = body
		? { ...requestInit, body, duplex: 'half' }
		: requestInit;

	assertFetchableUrl(current);

	const origin = new URL(current).origin;

	// A caller that asked for manual redirects is driving the loop itself (the preview
	// route), so guard the destination and hand the response straight back.
	if (init?.redirect === 'manual') {
		return baseFetch(current, firstHopInit);
	}

	for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
		assertFetchableUrl(current);

		const hopInit = hop === 0 ? firstHopInit : requestInit;
		const sameOrigin = new URL(current).origin === origin;
		const guardedInit = sameOrigin ? hopInit : withoutSensitiveHeaders(hopInit);
		const response = await baseFetch(current, { ...guardedInit, redirect: 'manual' });

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
