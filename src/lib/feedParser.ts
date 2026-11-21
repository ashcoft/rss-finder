import { XMLParser } from 'fast-xml-parser';

export interface FeedItem {
	title: string;
	link: string;
	pubDate?: string;
	description?: string;
	image?: string;
}

export interface ParsedFeed {
	title: string;
	link: string;
	description?: string;
	items: FeedItem[];
}

interface RawFeed {
	title?: string | { '#text'?: string; '@_href'?: string };
	link?: string | { '@_href'?: string } | Array<string | { '@_href'?: string }>;
	description?: string;
	item?: unknown | unknown[];
	entry?: unknown | unknown[];
	items?: unknown | unknown[];
	channel?: RawFeed;
	feed?: RawFeed;
}

function decodeEntities(text: string): string {
	return text.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|#38);/gi, (match, entity: string) => {
		const name = entity.toLowerCase();
		if (name === 'amp') return '&';
		if (name === 'lt') return '<';
		if (name === 'gt') return '>';
		if (name === 'quot') return '"';
		if (name === 'apos') return "'";
		const code = name.startsWith('#x') ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
		// fromCharCode truncates above U+FFFF, so astral entities need fromCodePoint.
		if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return match;
		return String.fromCodePoint(code);
	});
}

function toText(value: unknown): string {
	let text = '';
	if (typeof value === 'string') {
		text = value;
	} else if (value && typeof value === 'object') {
		const obj = value as Record<string, unknown>;
		if (typeof obj['#text'] === 'string') text = obj['#text'];
		else if (typeof obj['@_href'] === 'string') text = obj['@_href'];
		else if (typeof obj.title === 'string') text = obj.title;
		else if (typeof obj.title === 'object') return toText(obj.title);
		else if (typeof obj.content === 'string') text = obj.content;
	}
	return decodeEntities(text);
}

function extractLink(link: unknown): string {
	if (typeof link === 'string') return link;

	if (Array.isArray(link)) {
		const self = link.find((l): l is Record<string, unknown> => !!l && typeof l === 'object');
		if (self && typeof self['@_href'] === 'string') return self['@_href'];
		return toText(link[0]);
	}

	if (link && typeof link === 'object') {
		return toText(link);
	}

	return '';
}

function resolveLink(link: string, baseUrl: string): string {
	if (!link) return '';
	if (!baseUrl || /^[a-z][a-z0-9+.-]*:\/\//i.test(link)) return link;
	try {
		return new URL(link, baseUrl).toString();
	} catch {
		return link;
	}
}

const IMAGE_URL_PATTERN = /\.(?:jpe?g|png|gif|webp|avif|svg)(?:[?#]|$)/i;
// `\ssrc` rather than `\bsrc` so lazy-loading `data-src` attributes are not mistaken for src.
const IMG_SRC_PATTERN = /<img\b[^>]*?\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>`]+))/gi;
// Types that say nothing about the payload, so an image-looking URL still counts.
const INCONCLUSIVE_TYPES = new Set(['', 'application/octet-stream', 'binary/octet-stream']);

function isDataUrl(url: string): boolean {
	return /^data:/i.test(url);
}

function pickImageUrl(value: unknown): string {
	if (typeof value === 'string') {
		const url = value.trim();
		return isDataUrl(url) ? '' : url;
	}

	if (Array.isArray(value)) {
		for (const entry of value) {
			const url = pickImageUrl(entry);
			if (url) return url;
		}
		return '';
	}

	if (value && typeof value === 'object') {
		const obj = value as Record<string, unknown>;
		// RSS enclosures and media:* elements put the URL in an attribute; Atom-style
		// elements such as <itunes:image href="..."/> and out-of-line <content src="..."/>
		// use href/src instead.
		for (const key of ['@_url', '@_href', '@_src']) {
			const candidate = obj[key];
			if (typeof candidate !== 'string') continue;
			const url = candidate.trim();
			if (url && !isDataUrl(url)) return url;
		}
	}

	return '';
}

function isImage(value: unknown): boolean {
	if (!value || typeof value !== 'object') return false;
	const obj = value as Record<string, unknown>;
	const type = typeof obj['@_type'] === 'string' ? obj['@_type'].toLowerCase() : '';
	const medium = typeof obj['@_medium'] === 'string' ? obj['@_medium'].toLowerCase() : '';

	if (type.startsWith('image/') || medium === 'image') return true;
	// An explicit audio/video/other medium wins over an image-looking file extension.
	if (medium) return false;
	return INCONCLUSIVE_TYPES.has(type) && IMAGE_URL_PATTERN.test(pickImageUrl(obj));
}

function mediaEntries(value: unknown): Array<Record<string, unknown>> {
	if (Array.isArray(value)) return value.flatMap(mediaEntries);
	return value && typeof value === 'object' ? [value as Record<string, unknown>] : [];
}

function childThumbnail(value: unknown): string {
	for (const entry of mediaEntries(value)) {
		const url = pickImageUrl(entry.thumbnail);
		if (url) return url;
	}
	return '';
}

function pickImage(value: unknown): string {
	if (Array.isArray(value)) {
		for (const entry of value) {
			const url = pickImage(entry);
			if (url) return url;
		}
		return '';
	}
	return isImage(value) ? pickImageUrl(value) : '';
}

function pickFromMedia(value: unknown): string {
	for (const entry of mediaEntries(value)) {
		const url = pickImage(entry) || childThumbnail(entry);
		if (url) return url;
	}
	return '';
}

function firstImageInHtml(value: unknown): string {
	const html = toText(value);
	for (const match of html.matchAll(IMG_SRC_PATTERN)) {
		const src = (match[1] ?? match[2] ?? match[3] ?? '').trim();
		if (src && !isDataUrl(src)) return src;
	}
	return '';
}

// Atom xhtml content arrives as nested objects rather than markup, so walk the tree for an
// <img> element when the text scan finds nothing.
function findImgElement(value: unknown): string {
	if (Array.isArray(value)) {
		for (const entry of value) {
			const url = findImgElement(entry);
			if (url) return url;
		}
		return '';
	}

	if (!value || typeof value !== 'object') return '';
	const obj = value as Record<string, unknown>;

	if (obj.img !== undefined) {
		const url = pickImageUrl(obj.img);
		if (url) return url;
	}

	for (const child of Object.values(obj)) {
		const url = findImgElement(child);
		if (url) return url;
	}
	return '';
}

function extractImage(
	i: {
		link?: unknown;
		enclosure?: unknown;
		thumbnail?: unknown;
		image?: unknown;
		content?: unknown;
		encoded?: unknown;
		description?: unknown;
		summary?: unknown;
		group?: unknown;
	},
	baseUrl: string
): string {
	const enclosureLinks = mediaEntries(i.link).filter((entry) => entry['@_rel'] === 'enclosure');
	const groups = mediaEntries(i.group);
	const contents = [
		...mediaEntries(i.content),
		...groups.flatMap((group) => mediaEntries(group.content))
	];

	const image =
		pickImage(enclosureLinks) ||
		pickImage(i.enclosure) ||
		pickImageUrl(i.thumbnail) ||
		pickImageUrl(i.image) ||
		pickFromMedia(contents) ||
		pickFromMedia(groups) ||
		firstImageInHtml(i.encoded) ||
		firstImageInHtml(i.description) ||
		firstImageInHtml(i.summary) ||
		firstImageInHtml(i.content) ||
		findImgElement(i.encoded) ||
		findImgElement(i.content);

	return resolveLink(image, baseUrl);
}

function extractItem(item: unknown, baseUrl: string): FeedItem {
	const i = (item ?? {}) as {
		title?: unknown;
		link?: unknown;
		pubDate?: unknown;
		pubdate?: unknown;
		updated?: unknown;
		updated$?: unknown;
		published?: unknown;
		description?: unknown;
		summary?: unknown;
		content?: unknown;
		'@_href'?: unknown;
		guid?: unknown;
		enclosure?: unknown;
		thumbnail?: unknown;
		image?: unknown;
		encoded?: unknown;
		group?: unknown;
	};

	const link = resolveLink(extractLink(i.link), baseUrl);

	const date = toText(i.pubDate ?? i.pubdate ?? i.updated ?? i.published ?? i.updated$);
	const description = toText(i.description ?? i.summary ?? i.content);
	const image = extractImage(i, baseUrl);

	return {
		title: toText(i.title) || 'Untitled',
		link,
		...(date ? { pubDate: date } : {}),
		...(description ? { description } : {}),
		...(image ? { image } : {})
	};
}

export function parseFeedXml(xml: string, baseUrl: string): ParsedFeed {
	const parser = new XMLParser({
		ignoreAttributes: false,
		attributeNamePrefix: '@_',
		textNodeName: '#text',
		removeNSPrefix: true
	});

	const doc = parser.parse(xml) as { rss?: RawFeed; feed?: RawFeed; RDF?: RawFeed } | null;
	if (!doc) {
		throw new Error('Unable to parse feed');
	}

	let root: RawFeed | undefined;
	if (doc.rss?.channel) root = doc.rss;
	else if (doc.feed) root = doc.feed;
	else if (doc.RDF?.channel) root = doc.RDF;
	else if (doc.rss) root = doc.rss;
	if (!root) {
		throw new Error('Not a valid RSS or Atom feed');
	}

	const channel = root.channel ?? root;
	const title = toText(channel.title) || 'Untitled Feed';

	const link = resolveLink(extractLink(channel.link), baseUrl);

	const rawItems = channel.item ?? channel.entry ?? channel.items;
	const items = rawItems
		? (Array.isArray(rawItems) ? rawItems : [rawItems]).map((item) => extractItem(item, baseUrl))
		: [];

	return {
		title,
		link,
		...(channel.description ? { description: toText(channel.description) } : {}),
		items
	};
}
