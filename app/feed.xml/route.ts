import { feed } from "@/lib/db";
import { byline } from "@/lib/model";
import { absolute, baseUrl, SITE_NAME, TAGLINE } from "@/lib/site";

export const dynamic = "force-dynamic";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  const items = await feed(50).catch(() => []);
  const base = baseUrl();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title>${esc(SITE_NAME)}</title>
<link>${base}</link>
<description>${esc(TAGLINE)}</description>
${items
  .map(
    (i) => `<item>
<title>${esc(i.title)}</title>
<link>${base}/read/${i.slug}</link>
<guid isPermaLink="true">${base}/read/${i.slug}</guid>
<pubDate>${new Date(i.publishedAt).toUTCString()}</pubDate>
<author>${esc(byline(i))}</author>
<description>${esc(i.logline || `${i.pageCount} pages by ${byline(i)}`)}</description>
<media:content url="${esc(absolute(i.card))}" medium="image" width="1200" height="630"/>
</item>`,
  )
  .join("\n")}
</channel>
</rss>`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=300" } });
}
