"use client";
import { useEffect, useState } from "react";

/** Scroll mode (webtoon style) or one page at a time with arrow keys and tap-to-advance. */
export function Reader({ pages, title, slug }: { pages: string[]; title: string; slug: string }) {
  const [mode, setMode] = useState<"scroll" | "page">("scroll");
  const [i, setI] = useState(0);
  useEffect(() => {
    if (mode !== "page") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") setI((x) => Math.min(pages.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, pages.length]);
  return (
    <>
      <div className="row-btns" style={{ justifyContent: "center", marginTop: 22 }}>
        <div className="toggle" role="group" aria-label="Reading mode">
          <button aria-pressed={mode === "scroll"} onClick={() => setMode("scroll")}>Scroll</button>
          <button aria-pressed={mode === "page"} onClick={() => setMode("page")}>Page by page</button>
        </div>
      </div>
      {mode === "scroll" ? (
        <div className="pages">
          {pages.map((src, k) => (
            <figure key={k}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`${title}, page ${k + 1}`} width={1200} height={1800} loading={k < 2 ? "eager" : "lazy"} />
              <figcaption>
                <span>{k + 1} / {pages.length}</span>
                <a href={src} download={`${slug}-p${k + 1}.png`}>DOWNLOAD PNG</a>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="single">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pages[i]} alt={`${title}, page ${i + 1}`} width={1200} height={1800} onClick={() => setI((x) => Math.min(pages.length - 1, x + 1))} />
          <div className="single-nav">
            <button className="btn" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}>← Prev</button>
            <span className="px">{i + 1} / {pages.length}</span>
            <button className="btn primary" onClick={() => setI((x) => Math.min(pages.length - 1, x + 1))} disabled={i === pages.length - 1}>Next →</button>
          </div>
        </div>
      )}
    </>
  );
}
