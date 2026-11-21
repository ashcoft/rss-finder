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

	it('falls back to the text of a nested title object', () => {
		// `type="html"` makes fast-xml-parser emit an object with `#text`, exercising the
		// nested-object branch of toText rather than a plain string.
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title type="html">Nested Title</title><link>https://example.com/a</link></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com').items[0].title).toBe('Nested Title');
	});

	it('prefers description over summary when both are present', () => {
		const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><title>A</title>
  <entry><title>E</title><link href="https://example.com/e"/>
    <description>Description text</description>
    <summary>Summary text</summary>
    <content>Content text</content></entry>
</feed>`;

		expect(parseFeedXml(xml, 'https://example.com').items[0].description).toBe('Description text');
	});

	it('prefers summary over content when there is no description', () => {
		const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><title>A</title>
  <entry><title>E</title><link href="https://example.com/e"/>
    <summary>Summary text</summary><content>Content text</content></entry>
</feed>`;

		expect(parseFeedXml(xml, 'https://example.com').items[0].description).toBe('Summary text');
	});
	it('reads an image enclosure as the item image', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <enclosure url="https://example.com/photo.jpg" type="image/jpeg" length="1234"/></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0].image).toBe(
			'https://example.com/photo.jpg'
		);
	});

	it('reads a media:thumbnail image', () => {
		const xml = `<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <media:thumbnail url="https://cdn.example.com/thumb.png" width="320" height="180"/></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0].image).toBe(
			'https://cdn.example.com/thumb.png'
		);
	});

	it('reads a media:content element marked as an image', () => {
		const xml = `<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <media:group><media:content url="https://cdn.example.com/hero" medium="image"/></media:group></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0].image).toBe(
			'https://cdn.example.com/hero'
		);
	});

	it('reads an itunes:image href', () => {
		const xml = `<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <itunes:image href="https://example.com/cover.jpg"/></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0].image).toBe(
			'https://example.com/cover.jpg'
		);
	});

	it('falls back to the first img in content:encoded', () => {
		const xml = `<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <content:encoded><![CDATA[<p>Intro</p><img src="https://example.com/inline.webp" alt="x"/>]]></content:encoded></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0].image).toBe(
			'https://example.com/inline.webp'
		);
	});

	it('resolves a relative img src in the description against the feed URL', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <description><![CDATA[<p><img src="/images/a.jpg"/></p>]]></description></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/blog/feed.xml').items[0].image).toBe(
			'https://example.com/images/a.jpg'
		);
	});

	it('reads an image from content when the summary is plain text', () => {
		const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><title>A</title>
  <entry><title>E</title><link href="https://example.com/e"/>
    <summary>Plain summary without markup</summary>
    <content type="html">&lt;img src="https://example.com/from-content.png"/&gt;</content></entry>
</feed>`;

		const item = parseFeedXml(xml, 'https://example.com/feed').items[0];

		expect(item.description).toBe('Plain summary without markup');
		expect(item.image).toBe('https://example.com/from-content.png');
	});

	it('ignores non-image enclosures', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <enclosure url="https://example.com/audio.mp3" type="audio/mpeg" length="1234"/></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0]).not.toHaveProperty('image');
	});

	it('ignores data: URI images in descriptions', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <description><![CDATA[<img src="data:image/gif;base64,R0lGOD"/>]]></description></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0]).not.toHaveProperty('image');
	});
	it('ignores a data: URI in image metadata', () => {
		const xml = `<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <media:content url="data:image/png;base64,iVBORw0KGgo=" medium="image"/></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0]).not.toHaveProperty('image');
	});

	it('reads an Atom link with rel="enclosure" as the item image', () => {
		const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><title>A</title>
  <entry><title>E</title>
    <link rel="alternate" href="https://example.com/e"/>
    <link rel="enclosure" type="image/jpeg" href="https://example.com/photo.jpg"/></entry>
</feed>`;

		const item = parseFeedXml(xml, 'https://example.com/feed').items[0];

		expect(item.link).toBe('https://example.com/e');
		expect(item.image).toBe('https://example.com/photo.jpg');
	});

	it('matches an uppercase image MIME type', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <enclosure url="https://cdn.example.com/photo" type="IMAGE/JPEG"/></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0].image).toBe(
			'https://cdn.example.com/photo'
		);
	});

	it('ignores an audio enclosure whose URL looks like an image', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <enclosure url="https://example.com/episode.jpg" type="audio/mpeg"/></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0]).not.toHaveProperty('image');
	});

	it('reads an unquoted img src', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <description><![CDATA[<img src=/photo.jpg>]]></description></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0].image).toBe(
			'https://example.com/photo.jpg'
		);
	});

	it('uses src rather than a data-src placeholder', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <description><![CDATA[<img data-src="/placeholder.gif" src="/photo.jpg">]]></description></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0].image).toBe(
			'https://example.com/photo.jpg'
		);
	});

	it('skips a data: img and uses the next image in the HTML', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <description><![CDATA[<img src="data:image/gif;base64,R0lGOD"><img src="https://example.com/real.png">]]></description></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0].image).toBe(
			'https://example.com/real.png'
		);
	});

	it('reads a media:thumbnail nested in media:content', () => {
		const xml = `<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <media:content url="https://example.com/clip.mp4" type="video/mp4">
      <media:thumbnail url="https://example.com/still.jpg"/>
    </media:content></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0].image).toBe(
			'https://example.com/still.jpg'
		);
	});

	it('reads a thumbnail from any of several media:group elements', () => {
		const xml = `<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <media:group><media:content url="https://example.com/clip.mp4" type="video/mp4"/></media:group>
    <media:group><media:thumbnail url="https://example.com/group.jpg"/></media:group></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0].image).toBe(
			'https://example.com/group.jpg'
		);
	});

	it('reads an img nested in Atom xhtml content', () => {
		const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><title>A</title>
  <entry><title>E</title><link href="https://example.com/e"/>
    <content type="xhtml">
      <div xmlns="http://www.w3.org/1999/xhtml"><p>Intro</p><img src="https://example.com/xhtml.png"/></div>
    </content></entry>
</feed>`;

		expect(parseFeedXml(xml, 'https://example.com/feed').items[0].image).toBe(
			'https://example.com/xhtml.png'
		);
	});
	it('does not read a src= inside quoted alt text', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <description><![CDATA[<img alt="see src=/decoy.png here" src="/photo.jpg">]]></description></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0].image).toBe(
			'https://example.com/photo.jpg'
		);
	});

	it('reads an enclosure typed with MIME parameters', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <enclosure url="https://example.com/cover.jpg" type="application/octet-stream; name=&quot;cover.jpg&quot;"/></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0].image).toBe(
			'https://example.com/cover.jpg'
		);
	});

	it('picks the first image in Atom xhtml document order', () => {
		const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><title>A</title>
  <entry><title>E</title><link href="https://example.com/e"/>
    <content type="xhtml">
      <div xmlns="http://www.w3.org/1999/xhtml"><p><img src="https://example.com/first.png"/></p></div>
      <img src="https://example.com/second.png"/>
    </content></entry>
</feed>`;

		expect(parseFeedXml(xml, 'https://example.com/feed').items[0].image).toBe(
			'https://example.com/first.png'
		);
	});
	it('keeps a quoted src that contains a greater-than sign', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <description><![CDATA[<img src="https://example.com/photo.jpg?label=a>b">]]></description></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0].image).toBe(
			'https://example.com/photo.jpg?label=a>b'
		);
	});

	it('does not read src= from entity-encoded quotes in alt text', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <description><![CDATA[<img alt="she said &quot;src=/decoy.png&quot;" src="/photo.jpg">]]></description></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0].image).toBe(
			'https://example.com/photo.jpg'
		);
	});
	it('rejects an entity-encoded data: image and uses the next one', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <description><![CDATA[<img src="&#100;ata:image/gif;base64,R0lGOD"><img src="/photo.jpg">]]></description></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0].image).toBe(
			'https://example.com/photo.jpg'
		);
	});
	it('reads an img written with numeric character references', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <description>&#60;img src=&#34;/photo.jpg&#34;&#62;</description></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0].image).toBe(
			'https://example.com/photo.jpg'
		);
	});

	it('reads an img whose only quoted attribute uses numeric references', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <description>&lt;img src=&#34;/photo.jpg&#34;&gt;</description></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0].image).toBe(
			'https://example.com/photo.jpg'
		);
	});

	it('keeps src when another attribute has an unquoted apostrophe', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <description><![CDATA[<img src="/photo.jpg" data-credit=O'Reilly>]]></description></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0].image).toBe(
			'https://example.com/photo.jpg'
		);
	});
	it('keeps query parameters in an unquoted src', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <description><![CDATA[<img src=/photo.jpg?w=800&h=600>]]></description></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0].image).toBe(
			'https://example.com/photo.jpg?w=800&h=600'
		);
	});

	it('prefers a real image over one inside a code example', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <description><![CDATA[<code>&lt;img src="/example.png"&gt;</code><img src="/real.png">]]></description></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0].image).toBe(
			'https://example.com/real.png'
		);
	});

	it('keeps a real image next to an escaped greater-than in an unquoted attribute', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <description><![CDATA[<img alt=width&gt;height src="/real.png">]]></description></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0].image).toBe(
			'https://example.com/real.png'
		);
	});

	it('ignores an img written inside quoted alt text', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <description><![CDATA[<img alt="<img src='/decoy.jpg'>" data-src="/lazy.jpg"><img src="/real.jpg">]]></description></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0].image).toBe(
			'https://example.com/real.jpg'
		);
	});

	it('keeps the full URL when an unquoted src contains an escaped greater-than', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <description><![CDATA[<img src=/photo.jpg?label=a&gt;b>]]></description></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0].image).toBe(
			'https://example.com/photo.jpg?label=a%3Eb'
		);
	});

	it('rejects a data: URI hidden behind an encoded tab', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <description><![CDATA[<img src="d&#9;ata:image/gif;base64,R0lGOD">]]></description></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0]).not.toHaveProperty('image');
	});

	it('does not decode an XML image URL twice', () => {
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <enclosure url="https://example.com/photo.jpg?label=&amp;lt;" type="image/jpeg"/></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0].image).toBe(
			'https://example.com/photo.jpg?label=&lt;'
		);
	});

	it('discards an img whose quoted src never closes', () => {
		const long = 'a'.repeat(5000);
		const xml = `<rss version="2.0"><channel><title>T</title>
  <item><title>A</title><link>https://example.com/a</link>
    <description><![CDATA[<img src="/broken.jpg?${long}>]]></description></item>
</channel></rss>`;

		expect(parseFeedXml(xml, 'https://example.com/feed.xml').items[0]).not.toHaveProperty('image');
	});
});
