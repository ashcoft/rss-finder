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

function rawText(value: unknown): string {
	if (typeof value === 'string') return value;
	if (value && typeof value === 'object') {
		const obj = value as Record<string, unknown>;
		if (typeof obj['#text'] === 'string') return obj['#text'];
		if (typeof obj['@_href'] === 'string') return obj['@_href'];
		if (typeof obj.title === 'string') return obj.title;
		if (typeof obj.title === 'object') return rawText(obj.title);
		if (typeof obj.content === 'string') return obj.content;
	}
	return '';
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
const IMG_OPEN_PATTERN = /<img\b/gi;
// Real feeds do not contain megabyte-long tags; capping the per-tag scan keeps the whole
// pass linear even for hostile input.
const MAX_TAG_LENGTH = 4096;
// References that build markup, used only when a feed escapes its own HTML.
const MARKUP_ENTITY_PATTERN = /&(#x?[0-9a-f]+|lt|gt|amp);/gi;
// Types that say nothing about the payload, so an image-looking URL still counts.
const INCONCLUSIVE_TYPES = new Set(['', 'application/octet-stream', 'binary/octet-stream']);

function isDataUrl(url: string): boolean {
	return /^data:/i.test(url);
}

// URL parsers drop tabs and newlines, so do the same before the scheme check:
// `d&#9;ata:` must not slip past it.
function stripControl(value: string): string {
	return value.replace(/[\t\n\r\f]+/g, '').trim();
}

// XML attribute values are already decoded by the parser, so decoding again would turn a
// literal `&amp;lt;` into `<`.
function cleanMetadataUrl(value: string): string {
	return stripControl(value);
}

// Inline HTML is scanned before decoding, so its attribute values still hold references.
function cleanHtmlUrl(value: string): string {
	return stripControl(decodeEntities(value));
}

function decodeMarkupEntities(text: string): string {
	return text.replace(MARKUP_ENTITY_PATTERN, (match, entity: string) => {
		const name = entity.toLowerCase();
		if (name === 'lt') return '<';
		if (name === 'gt') return '>';
		if (name === 'amp') return '&';
		const code = name.startsWith('#x') ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
		if (code === 0x3c) return '<';
		if (code === 0x3e) return '>';
		if (code === 0x26) return '&';
		return match;
	});
}

function pickImageUrl(value: unknown): string {
	if (typeof value === 'string') {
		const url = cleanMetadataUrl(value);
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
			const url = cleanMetadataUrl(candidate);
			if (url && !isDataUrl(url)) return url;
		}
	}

	return '';
}

function isImage(value: unknown): boolean {
	if (!value || typeof value !== 'object') return false;
	const obj = value as Record<string, unknown>;
	// `type` can carry parameters, e.g. `application/octet-stream; name="cover.jpg"`.
	const type =
		typeof obj['@_type'] === 'string' ? obj['@_type'].split(';')[0].trim().toLowerCase() : '';
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

// A quote delimiter may arrive literally or as a character reference, and either form
// only opens a value; inside a value it is text.
const QUOTE_ENTITY_PATTERN = /^(&quot;|&apos;|&#0*34;|&#x0*22;|&#0*39;|&#x0*27;)/i;

function quoteDelimiterAt(html: string, index: number): string {
	const char = html[index];
	if (char === '"' || char === "'") return char;
	const match = QUOTE_ENTITY_PATTERN.exec(html.slice(index, index + 8));
	return match ? match[0] : '';
}

function scanImgTag(html: string, start: number): { src: string; end: number } {
	const limit = Math.min(html.length, start + MAX_TAG_LENGTH);
	let src = '';
	let i = start;

	while (i < limit) {
		const char = html[i];

		if (char === '>') return { src, end: i + 1 };
		if (char === '/' || /\s/.test(char)) {
			i += 1;
			continue;
		}

		const nameStart = i;
		while (i < limit && !/[\s=>/]/.test(html[i])) i += 1;
		const name = html.slice(nameStart, i).toLowerCase();

		while (i < limit && /\s/.test(html[i])) i += 1;

		let value = '';
		if (html[i] === '=') {
			i += 1;
			while (i < limit && /\s/.test(html[i])) i += 1;

			const open = quoteDelimiterAt(html, i);
			if (open) {
				const closing = open.toLowerCase();
				const valueStart = i + open.length;
				let end = valueStart;
				while (end < limit) {
					const candidate = quoteDelimiterAt(html, end);
					if (candidate && candidate.toLowerCase() === closing) break;
					end += 1;
				}
				if (end >= limit) {
					// The value never closed inside the cap, so it is not a usable URL.
					return { src, end: limit };
				}
				value = html.slice(valueStart, end);
				i = end + closing.length;
			} else {
				const valueStart = i;
				while (i < limit && !/[\s>]/.test(html[i])) i += 1;
				value = html.slice(valueStart, i);
			}
		}

		if (!src && name === 'src') {
			// Quotes that arrived as character references end up inside an unquoted value.
			const url = cleanHtmlUrl(value)
				.replace(/^"([^"]*)"$|^'([^']*)'$/, '$1$2')
				.trim();
			if (url && !isDataUrl(url)) src = url;
		}
	}

	return { src, end: limit };
}

function scanForImage(html: string): string {
	IMG_OPEN_PATTERN.lastIndex = 0;

	let match: RegExpExecArray | null;
	while ((match = IMG_OPEN_PATTERN.exec(html)) !== null) {
		const tag = scanImgTag(html, (match.index ?? 0) + match[0].length);
		if (tag.src) return tag.src;
		// Resume after the tag just consumed, so an `<img` inside its attributes is not a candidate.
		IMG_OPEN_PATTERN.lastIndex = Math.max(IMG_OPEN_PATTERN.lastIndex, tag.end);
	}

	return '';
}

function firstImageInHtml(value: unknown): string {
	const html = rawText(value);
	const direct = scanForImage(html);
	if (direct) return direct;

	// Some feeds escape the markup itself (`&lt;img …&gt;` or numeric references). Only decode
	// when the literal scan found nothing, so escaped examples cannot beat a real image.
	const decoded = decodeMarkupEntities(html);
	return decoded === html ? '' : scanForImage(decoded);
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

	// Walk children in document order so the first image wins, even when a nested
	// subtree holds an earlier <img> than a direct sibling.
	for (const [key, child] of Object.entries(obj)) {
		if (key === 'img') {
			const url = pickImageUrl(child);
			if (url) return url;
		}
		const nested = findImgElement(child);
		if (nested) return nested;
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
