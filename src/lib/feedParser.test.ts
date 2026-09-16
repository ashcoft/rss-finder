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
});
