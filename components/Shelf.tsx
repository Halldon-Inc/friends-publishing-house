import Link from "next/link";
import { byline } from "@/lib/model";
import type { FeedEntry } from "@/lib/db";

export function Shelf({ issues, emptyText }: { issues: FeedEntry[]; emptyText?: string }) {
  if (!issues.length) {
    return (
      <div className="empty">
        <h3>The press is warming up.</h3>
        <p>{emptyText ?? "No issues yet. Holders: open the studio and publish the first one."}</p>
        <Link href="/studio" className="btn primary">Open the studio</Link>
      </div>
    );
  }
  return (
    <div className="shelf">
      {issues.map((i) => (
        <Link key={i.slug} href={`/read/${i.slug}`} className="issue">
          <div className="cover">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={i.cover} alt={`Cover of ${i.title}`} loading="lazy" width={1200} height={1800} />
          </div>
          <h3>{i.title}</h3>
          <div className="meta">
            <span>by {byline(i)}</span>
            <span className="chip">{i.color ? "Colour" : "B&W"}</span>
            <span className="chip">{i.pageCount}p</span>
            {i.remixOf ? <span className="chip signal">Remix</span> : null}
          </div>
        </Link>
      ))}
    </div>
  );
}
