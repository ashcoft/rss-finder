import { describe, expect, it } from 'vitest';
import { parseFeedXml } from './feedParser.js';

describe('parseFeedXml', () => {
	it('parses an RSS 2.0 feed with items', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Example Blog</title>
    <link>https://example.com</link>
    <description>An example blog</description>
    <item>
      <title>Hello World</title>
      <link>https://example.com/hello</link>
      <pubDate>Mon, 01 Jan 2024 00:00:00 +0000</pubDate>
      <description>First post</description>
    </item>
    <item>
      <title>Second Post</title>
      <link>https://example.com/second</link>
    </item>
  </channel>
</rss>`;

		const feed = parseFeedXml(xml, 'https://example.com/feed.xml');

		expect(feed.title).toBe('Example Blog');
		expect(feed.link).toBe('https://example.com');
		expect(feed.description).toBe('An example blog');
		expect(feed.items).toHaveLength(2);
		expect(feed.items[0]).toEqual({
			title: 'Hello World',
			link: 'https://example.com/hello',
			pubDate: 'Mon, 01 Jan 2024 00:00:00 +0000',
			description: 'First post'
		});
		expect(feed.items[1].title).toBe('Second Post');
	});

	it('resolves relative links in an Atom feed', () => {
		const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <link href="https://example.org/feed" rel="self"/>
  <entry>
    <title>Post A</title>
    <link href="/a"/>
    <updated>2024-02-02T10:00:00Z</updated>
  </entry>
  <entry>
    <title>Post B</title>
    <link href="https://other.example/b"/>
  </entry>
</feed>`;

		const feed = parseFeedXml(xml, 'https://example.org/feed');

		expect(feed.title).toBe('Atom Feed');
		expect(feed.link).toBe('https://example.org/feed');
		expect(feed.items).toHaveLength(2);
		expect(feed.items[0].link).toBe('https://example.org/a');
		expect(feed.items[0].pubDate).toBe('2024-02-02T10:00:00Z');
		expect(feed.items[1].link).toBe('https://other.example/b');
	});

	it('parses an RDF feed', () => {
		const xml = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/">
  <channel rdf:about="https://rdf.example/feed">
    <title>RDF Blog</title>
    <link>https://rdf.example</link>
    <item rdf:about="https://rdf.example/post1">
      <title>RDF Post</title>
      <link>https://rdf.example/post1</link>
    </item>
  </channel>
</rdf:RDF>`;

		const feed = parseFeedXml(xml, 'https://rdf.example/feed');

		expect(feed.title).toBe('RDF Blog');
		expect(feed.items).toHaveLength(1);
		expect(feed.items[0].title).toBe('RDF Post');
	});

	it('handles a single item item (not wrapped in an array)', () => {
		const xml = `<rss version="2.0"><channel><title>One</title>
  <item><title>Only</title><link>https://example.com/only</link></item>
</channel></rss>`;

		const feed = parseFeedXml(xml, 'https://example.com');

		expect(feed.items).toHaveLength(1);
		expect(feed.items[0].title).toBe('Only');
	});

	it('decodes HTML entities in titles and descriptions', () => {
		const xml = `<rss version="2.0"><channel><title>Tech &amp; Science</title>
  <item><title>5 &lt; 6 &#038; more</title><link>https://example.com/x</link>
  <description>Tom &amp; Jerry &quot;quoted&quot;</description></item>
</channel></rss>`;

		const feed = parseFeedXml(xml, 'https://example.com');

		expect(feed.title).toBe('Tech & Science');
		expect(feed.items[0].title).toBe('5 < 6 & more');
		expect(feed.items[0].description).toBe('Tom & Jerry "quoted"');
	});

	it('throws for non-feed XML', () => {
		expect(() => parseFeedXml('<html><body>hello</body></html>', 'https://example.com')).toThrow(
			'Not a valid RSS or Atom feed'
		);
	});

	it('throws for empty input', () => {
		expect(() => parseFeedXml('', 'https://example.com')).toThrow();
	});

	it('decodes astral (non-BMP) numeric entities without truncation', () => {
		const xml = '<rss version="2.0"><channel><title>x &#128512; y</title></channel></rss>';

		const feed = parseFeedXml(xml, 'https://example.com');

		expect(feed.title).toBe('x \u{1F600} y');
	});

	it('decodes hexadecimal astral entities', () => {
		const xml = '<rss version="2.0"><channel><title>&#x1F600;</title></channel></rss>';

		expect(parseFeedXml(xml, 'https://example.com').title).toBe('\u{1F600}');
	});

	it('leaves out-of-range numeric entities untouched', () => {
		const xml = '<rss version="2.0"><channel><title>&#1114112;</title></channel></rss>';

		expect(parseFeedXml(xml, 'https://example.com').title).toBe('&#1114112;');
	});

	it('preserves CDATA content verbatim', () => {
		const xml = `<rss version="2.0"><channel><title><![CDATA[My & Blog]]></title>
  <item><title><![CDATA[Post <b>1</b>]]></title><link>https://example.com/1</link></item>
</channel></rss>`;

		const feed = parseFeedXml(xml, 'https://example.com');

		expect(feed.title).toBe('My & Blog');
		expect(feed.items[0].title).toBe('Post <b>1</b>');
	});

	it('falls back to "Untitled" when an item has no title', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><link>https://example.com/x</link></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com').items[0].title).toBe('Untitled');
	});

	it('falls back to "Untitled Feed" when the channel has no title', () => {
		const xml = '<rss version="2.0"><channel><link>https://example.com</link></channel></rss>';

		expect(parseFeedXml(xml, 'https://example.com').title).toBe('Untitled Feed');
	});

	it('treats a self-closing empty link as an empty string', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link/></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com').items[0].link).toBe('');
	});

	it('keeps an absolute link even when it differs in scheme from the base', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>http://plain.example/a</link></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed').items[0].link).toBe(
			'http://plain.example/a'
		);
	});

	it('returns an empty items array for a feed with no entries', () => {
		const xml = '<rss version="2.0"><channel><title>Empty</title></channel></rss>';

		expect(parseFeedXml(xml, 'https://example.com').items).toEqual([]);
	});

	it('parses Atom entries that only expose an updated timestamp', () => {
		const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><title>A</title>
  <entry><title>E</title><link href="https://example.com/e"/><updated>2024-03-03T00:00:00Z</updated></entry>
</feed>`;

		const item = parseFeedXml(xml, 'https://example.com').items[0];

		expect(item.pubDate).toBe('2024-03-03T00:00:00Z');
		expect(item.link).toBe('https://example.com/e');
	});

	it('does not set optional fields when they are absent', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>Only</title><link>https://example.com/only</link></item>
</channel></rss>`;

		const item = parseFeedXml(xml, 'https://example.com').items[0];

		expect(item).not.toHaveProperty('pubDate');
		expect(item).not.toHaveProperty('description');
	});

	it('prefers the href of the first object link in an Atom link array', () => {
		const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><title>A</title>
  <entry>
    <title>E</title>
    <link rel="alternate" href="https://example.com/alt"/>
    <link rel="self" href="https://example.com/self"/>
  </entry>
</feed>`;

		expect(parseFeedXml(xml, 'https://example.com').items[0].link).toBe('https://example.com/alt');
	});

	it('resolves a relative link against a base URL with a path', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>post/1</link></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/blog/feed.xml').items[0].link).toBe(
			'https://example.com/blog/post/1'
		);
	});

	it('keeps an unresolvable relative link as-is instead of throwing', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>post/1</link></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'not-a-valid-base').items[0].link).toBe('post/1');
	});

	it('reads a plain-string Atom link', () => {
		const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><title>A</title>
  <entry><title>E</title><link>https://example.com/plain</link></entry>
</feed>`;

		expect(parseFeedXml(xml, 'https://example.com').items[0].link).toBe(
			'https://example.com/plain'
		);
	});

	it('falls back to an entry title when an item only has a nested title object', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title><![CDATA[Real Title]]></title><link>https://example.com/a</link></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com').items[0].title).toBe('Real Title');
	});

	it('prefers description over summary when both are present', () => {
		const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><title>A</title>
  <entry><title>E</title><link href="https://example.com/e"/>
    <summary>Summary text</summary><content>Content text</content></entry>
</feed>`;

		expect(parseFeedXml(xml, 'https://example.com').items[0].description).toBe('Summary text');
	});
});
