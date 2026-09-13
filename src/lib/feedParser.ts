import { XMLParser } from 'fast-xml-parser';

export interface FeedItem {
	title: string;
	link: string;
	pubDate?: string;
	description?: string;
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
		if (entity === 'amp') return '&';
		if (entity === 'lt') return '<';
		if (entity === 'gt') return '>';
		if (entity === 'quot') return '"';
		if (entity === 'apos') return "'";
		const code = entity.toLowerCase().startsWith('#x')
			? parseInt(entity.slice(2), 16)
			: parseInt(entity.slice(1), 10);
		return isNaN(code) ? match : String.fromCharCode(code);
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
	};

	const link = resolveLink(extractLink(i.link), baseUrl);

	const date = toText(i.pubDate ?? i.pubdate ?? i.updated ?? i.published ?? i.updated$);
	const description = toText(i.description ?? i.summary ?? i.content);

	return {
		title: toText(i.title) || 'Untitled',
		link,
		...(date ? { pubDate: date } : {}),
		...(description ? { description } : {})
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
