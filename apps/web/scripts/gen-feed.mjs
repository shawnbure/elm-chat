import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ORIGIN = process.env.SITE_ORIGIN ?? "https://elm.chat";
const slugs = [
  "security-and-limitations",
  "send-a-file-securely",
  "temporary-financial-handoff",
  "the-internet-needs-places-that-forget",
  "why-i-built-elm-chat",
  "deletion-distributed-systems-contract",
  "building-ephemeral-chat-cloudflare",
  "durable-objects-websocket-hibernation",
  "journalist-source-communication",
  "temporary-private-chat",
  "one-time-secret-chat",
  "send-a-password-securely",
  "self-destructing-chat"
];

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function readPage(slug, position) {
  const html = readFileSync(join("dist", slug, "index.html"), "utf8");
  const structuredDataMatch = html.match(
    /<script id="structured-data" type="application\/ld\+json">([\s\S]*?)<\/script>/
  );
  if (!structuredDataMatch) {
    throw new Error(`Missing structured data for ${slug}`);
  }

  const data = JSON.parse(structuredDataMatch[1]);
  const title = data.headline ?? data.name;
  const description = data.description;
  const published = data.datePublished;
  if (!title || !description || !published) {
    throw new Error(`Incomplete feed metadata for ${slug}`);
  }

  return {
    description,
    position,
    published,
    title,
    url: `${ORIGIN}/${slug}`
  };
}

const items = slugs
  .map(readPage)
  .sort(
    (left, right) =>
      Date.parse(right.published) - Date.parse(left.published) ||
      left.position - right.position
  );

const itemXml = items
  .map(
    (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <guid isPermaLink="true">${escapeXml(item.url)}</guid>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${new Date(`${item.published}T00:00:00Z`).toUTCString()}</pubDate>
    </item>`
  )
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>elm.chat — articles and technical notes</title>
    <link>${ORIGIN}/</link>
    <description>Writing about ephemeral encrypted messaging, deliberate data minimization, Cloudflare architecture, and the limits of disposable communication.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>elm.chat build</generator>
    <atom:link href="${ORIGIN}/feed.xml" rel="self" type="application/rss+xml" />
${itemXml}
  </channel>
</rss>
`;

writeFileSync("dist/feed.xml", xml);
console.log(`feed.xml generated with ${items.length} entries`);
