import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublished } from "@/lib/db";
import { byline } from "@/lib/model";

export const revalidate = 60;
export const metadata: Metadata = { robots: { index: false } };

/** A compact reader for iframes on other sites. Framing is allowed only on /embed (see next.config.mjs). */
export default async function Embed({ params }: { params: Promise<{ slug: string }> }) {
  const p = await getPublished((await params).slug);
  if (!p) notFound();
  return (
    <div className="embed">
      <div className="e-top">
        <b style={{ fontFamily: "var(--f-display)", fontWeight: 400 }}>{p.title}</b>
        <a href={`/read/${p.slug}`} target="_blank" rel="noopener">by {byline(p)} · FRIENDS PUBLISHING HOUSE ↗</a>
      </div>
      <div className="e-pages">
        {p.pages.map((src, k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={k} src={src} alt={`${p.title}, page ${k + 1}`} width={1200} height={1800} loading={k ? "lazy" : "eager"} />
        ))}
      </div>
    </div>
  );
}
