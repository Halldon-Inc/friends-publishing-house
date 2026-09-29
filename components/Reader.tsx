"use client";
import { useEffect, useRef, useState } from "react";

/** Scroll mode (webtoon style) or one page at a time: arrow keys, swipe, or tap the right side for next, the left for back. */
export function Reader({ pages, title, slug }: { pages: string[]; title: string; slug: string }) {
  const [mode, setMode] = useState<"scroll" | "page">("scroll");
  const [i, setI] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const img = useRef<HTMLImageElement>(null);
  // A sideways swipe turns the page, so it must not also start a scroll gesture (whose fling can eat the next tap).
  useEffect(() => {
    const el = img.current;
    if (!el) return;
    let x0 = 0;
    let y0 = 0;
    const down = (e: TouchEvent) => {
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
    };
    const move = (e: TouchEvent) => {
      if (e.touches.length === 1 && Math.abs(e.touches[0].clientX - x0) > Math.abs(e.touches[0].clientY - y0)) e.preventDefault();
    };
    el.addEventListener("touchstart", down, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    return () => {
      el.removeEventListener("touchstart", down);
      el.removeEventListener("touchmove", move);
    };
  }, [mode]);
  const next = () => setI((x) => Math.min(pages.length - 1, x + 1));
  const prev = () => setI((x) => Math.max(0, x - 1));
  const onDown = (e: React.PointerEvent<HTMLImageElement>) => {
    if (e.button === 0) start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onUp = (e: React.PointerEvent<HTMLImageElement>) => {
    const s = start.current;
    start.current = null;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) return dx < 0 ? next() : prev();
    if (Math.hypot(dx, dy) > 12) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (e.clientX < r.left + r.width / 3) prev();
    else next();
  };
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
          <img ref={img} src={pages[i]}
 alt={`${title}, page ${i + 1}`} width={1200} height={1800} draggable={false} onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (start.current = null)} />
          <div className="single-nav">
            <button className="btn" onClick={prev} disabled={i === 0}>← Prev</button>
            <span className="px" aria-live="polite">{i + 1} / {pages.length}</span>
            <button className="btn primary" onClick={next} disabled={i === pages.length - 1}>Next →</button>
          </div>
          <p className="single-hint">Swipe or tap the page to turn it.</p>

        </div>
      )}
    </>
  );
}
