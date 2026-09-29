"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { makeShareCard } from "@/components/render/card";
import { svgToPng } from "@/components/render/export";
import { PageSvg } from "@/components/render/PageSvg";
import { artReady } from "@/components/useArt";
import { api } from "@/components/useSession";
import type { FriendArt } from "@/lib/art";
import { byline, storyCast, type Story } from "@/lib/model";
import { ShareButtons } from "@/components/ShareButtons";

type Phase = { step: "ready" } | { step: "working"; label: string; done: number; total: number } | { step: "done"; slug: string } | { step: "error"; message: string };

export function PublishModal({ story, onClose, onPublished }: { story: Story; onClose(): void; onPublished(p: NonNullable<Story["published"]>): void }) {
  const [phase, setPhase] = useState<Phase>({ step: "ready" });
  const [art, setArt] = useState<Map<string, FriendArt> | null>(null);
  const refs = useRef<(SVGSVGElement | null)[]>([]);

  useEffect(() => {
    void artReady(storyCast(story.pages)).then(setArt);
  }, [story.pages]);

  const publish = async () => {
    const total = story.pages.length + 3;
    let done = 0;
    const tick = (label: string) => setPhase({ step: "working", label, done: done++, total });
    try {
      tick("Reserving your link");
      const begin = await api<{ slug: string; version: number; pages: number }>(`/api/publish/${story.id}`, { method: "POST" });
      const put = async (asset: string, blob: Blob) => {
        const r = await fetch(`/api/publish/${story.id}?slug=${begin.slug}&version=${begin.version}&asset=${asset}`, { method: "PUT", headers: { "content-type": "image/png" }, body: blob });
        if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? `Upload failed (${r.status})`);
      };
      let cover: Blob | null = null;
      for (let i = 0; i < story.pages.length; i++) {
        tick(`Inking page ${i + 1} of ${story.pages.length}`);
        const svg = refs.current[i];
        if (!svg) throw new Error("A page did not render. Close this and try again.");
        const png = await svgToPng(svg, 1200, 1800);
        if (i === 0) cover = png;
        await put(`p${i + 1}`, png);
      }
      tick("Printing the share card");
      await put("card", await makeShareCard(cover!, { title: story.title, by: byline(story), pages: story.pages.length, color: story.color }));
      tick("Putting it on the shelf");
      const fin = await api<{ slug: string; version: number }>(`/api/publish/${story.id}`, { method: "PATCH", json: { slug: begin.slug, version: begin.version } });
      onPublished({ slug: fin.slug, version: fin.version, at: Date.now() });
      setPhase({ step: "done", slug: fin.slug });
    } catch (e) {
      setPhase({ step: "error", message: (e as Error).message });
    }
  };

  const unpublish = async () => {
    if (!confirm("Take this issue off the shelf? Its link will stop working.")) return;
    await api(`/api/publish/${story.id}`, { method: "DELETE" });
    onClose();
    location.reload();
  };

  const busy = phase.step === "working";
  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="pub-title" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal">
        {phase.step === "done" ? (
          <>
            <span className="chip signal">LIVE</span>
            <h2 id="pub-title">“{story.title}” is on the shelf.</h2>
            <p>Anyone can read it now, no wallet needed. When you post the link, X and Farcaster show your share card.</p>
            <ShareButtons slug={phase.slug} title={story.title} />
            <div className="row-btns" style={{ marginTop: 18 }}>
              <Link className="btn primary" href={`/read/${phase.slug}`}>Read it</Link>
              <button className="btn" onClick={onClose}>Back to editing</button>
            </div>
          </>
        ) : (
          <>
            <h2 id="pub-title">{story.published ? "Republish" : "Publish"} “{story.title}”</h2>
            <p>
              {story.pages.length} page{story.pages.length === 1 ? "" : "s"}, {story.color ? "colour" : "black and white"}, by <b>{byline(story)}</b>. Your pages are rendered at 1200 x 1800 and a share card is made for X.
              {story.published ? " The link stays the same; readers see the new version." : ""}
            </p>
            {!story.logline || !story.penName ? <p className="note">Tip: add a logline and pen name in Issue details (right panel) so the shelf and your X card read better.</p> : null}
            {phase.step === "working" ? (
              <>
                <div className="progress" aria-hidden>
                  <div style={{ width: `${Math.round((phase.done / phase.total) * 100)}%` }} />
                </div>
                <p className="px" aria-live="polite">{phase.label.toUpperCase()}…</p>
              </>
            ) : null}
            {phase.step === "error" ? <div className="err" role="alert">{phase.message}</div> : null}
            <div className="row-btns" style={{ marginTop: 18 }}>
              <button className="btn dark big" onClick={() => void publish()} disabled={busy || !art}>
                {!art ? "Loading Friends…" : busy ? "Publishing…" : story.published ? "Republish" : "Publish it"}
              </button>
              <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
              {story.published && !busy ? (
                <button className="btn danger" onClick={() => void unpublish()}>Unpublish</button>
              ) : null}
            </div>
          </>
        )}
      </div>
      {art ? (
        <div aria-hidden style={{ position: "fixed", left: -10000, top: 0, width: 800, pointerEvents: "none" }}>
          {story.pages.map((p, i) => (
            <PageSvg
              key={i}
              page={p}
              color={story.color}
              art={art}
              uid={`x${i}`}
              svgRef={(el) => {
                refs.current[i] = el;
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
