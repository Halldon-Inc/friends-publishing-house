import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reader } from "@/components/Reader";
import { ShareButtons } from "@/components/ShareButtons";
import { getPublished } from "@/lib/db";
import { byline, shortAddr } from "@/lib/model";
import { absolute, SITE_NAME } from "@/lib/site";

export const revalidate = 60;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getPublished((await params).slug);
  if (!p) return { title: "Not found" };
  const description = p.logline || `A ${p.pages.length}-page ${p.color ? "colour" : "black and white"} manga by ${byline(p)}, starring their Rare Friends.`;
  const card = absolute(p.card);
  return {
    title: p.title,
    description,
    alternates: { canonical: `/read/${p.slug}` },
    openGraph: { type: "article", title: p.title, description, siteName: SITE_NAME, url: `/read/${p.slug}`, images: [{ url: card, width: 1200, height: 630, alt: `${p.title}, by ${byline(p)}` }] },
    twitter: { card: "summary_large_image", title: p.title, description, images: [card] },
  };
}

export default async function ReadPage({ params }: Props) {
  const p = await getPublished((await params).slug);
  if (!p) notFound();
  return (
    <div className="wrap">
      <header className="reader-top">
        <div>
          <div className="row-btns">
            <span className="chip dark">{p.color ? "COLOUR" : "BLACK & WHITE"}</span>
            <span className="chip">{p.pages.length} PAGES</span>
            {p.remixOf ? (
              <Link href={`/read/${p.remixOf.slug}`} className="chip signal" style={{ textDecoration: "none" }}>
                REMIX OF “{p.remixOf.title.toUpperCase()}”
              </Link>
            ) : null}
          </div>
          <h1>{p.title}</h1>
          {p.logline ? <p className="logline">{p.logline}</p> : null}
          <div className="by">
            <span>
              by <Link href={`/creator/${p.owner}`}><b>{byline(p)}</b></Link>
            </span>
            {p.penName ? <span className="mute">{shortAddr(p.owner)}</span> : null}
            <span className="mute">{new Date(p.publishedAt).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" })}</span>
          </div>
        </div>
        <ShareButtons slug={p.slug} title={p.title} />
      </header>
      <Reader pages={p.pages} title={p.title} slug={p.slug} />
      <div className="end">
        <div className="sfx">THE END</div>
        <p>Liked it? Holders can remix this issue with their own Friends.</p>
        <div className="row-btns" style={{ justifyContent: "center" }}>
          <Link className="btn primary big" href={`/studio?remix=${p.slug}`}>Remix this issue</Link>
          <Link className="btn big" href="/#shelf">More manga</Link>
        </div>
      </div>
    </div>
  );
}
