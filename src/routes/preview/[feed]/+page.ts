import { decodeFeedUrl } from '$lib/utils.js';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	let feedUrl: string;
	try {
		feedUrl = decodeFeedUrl(params.feed);
	} catch {
		throw error(400, 'Invalid feed link');
	}

	try {
		const parsed = new URL(feedUrl);
		if (!/^https?:$/.test(parsed.protocol)) {
			throw new Error('unsupported protocol');
		}
	} catch {
		throw error(400, 'Invalid feed URL');
	}

	return { feedUrl };
};
