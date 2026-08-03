// Generates dist/sitemap.xml at build time so `lastmod` is always current —
// this is what keeps the sitemap "maintained" without manual edits.
//
// Only public, indexable URLs belong here. Room pages (/c/:id) are private,
// secret, and ephemeral, so they are deliberately excluded (and blocked in
// robots.txt).
import { writeFileSync, existsSync, mkdirSync } from "node:fs";

const ORIGIN = process.env.SITE_ORIGIN ?? "https://elm.chat";

const urls = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/self-destructing-chat", changefreq: "monthly", priority: "0.8" },
  { path: "/send-a-password-securely", changefreq: "monthly", priority: "0.8" },
  { path: "/one-time-secret-chat", changefreq: "monthly", priority: "0.8" },
  { path: "/temporary-private-chat", changefreq: "monthly", priority: "0.8" },
  { path: "/journalist-source-communication", changefreq: "monthly", priority: "0.8" },
  { path: "/temporary-financial-handoff", changefreq: "monthly", priority: "0.8" },
  { path: "/press", changefreq: "monthly", priority: "0.6" },
  { path: "/internet-needs-places-that-forget", changefreq: "monthly", priority: "0.8" },
  { path: "/why-i-built-elm-chat", changefreq: "monthly", priority: "0.7" },
  { path: "/building-ephemeral-chat-cloudflare", changefreq: "monthly", priority: "0.8" },
  { path: "/durable-objects-websocket-hibernation", changefreq: "monthly", priority: "0.8" }
];

const lastmod = new Date().toISOString().slice(0, 10);

const body = urls
  .map(
    ({ path, changefreq, priority }) =>
      `  <url>\n` +
      `    <loc>${ORIGIN}${path}</loc>\n` +
      `    <lastmod>${lastmod}</lastmod>\n` +
      `    <changefreq>${changefreq}</changefreq>\n` +
      `    <priority>${priority}</priority>\n` +
      `  </url>`
  )
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

if (!existsSync("dist")) {
  mkdirSync("dist", { recursive: true });
}
writeFileSync("dist/sitemap.xml", xml);
console.log(`sitemap.xml generated for ${ORIGIN} (lastmod ${lastmod}, ${urls.length} url)`);
