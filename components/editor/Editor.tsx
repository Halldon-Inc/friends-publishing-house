"use client";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PageSvg } from "@/components/render/PageSvg";
import { loadPageFonts } from "@/components/render/text";
import { useArt } from "@/components/useArt";
import { useAppViewport, useCanvasTouch, useCoarsePointer, useUnitsPerPx } from "@/components/useAppViewport";
import { useAutosave } from "@/components/useAutosave";
import { api } from "@/components/useSession";
import { MAX_ITEMS_PER_PAGE, MAX_PAGES, PAGE_W, newId, newPage, panelBox, storyCast, type FriendRef, type Item, type Page, type Story } from "@/lib/model";
import { panelAt, sizeOf, withSize } from "./geometry";
import { Inspector } from "./Inspector";
import { PublishModal } from "./PublishModal";

export type Sel = { k: "item"; id: string } | { k: "panel"; i: number } | null;
/** Phone tray tabs; on desktop every section shows at once. */
export type TrayTab = "add" | "edit" | "page" | "issue";
const TRAY_TABS: [TrayTab, string][] = [["add", "Add"], ["edit", "Edit"], ["page", "Page"], ["issue", "Issue"]];
type Drag =
  | { mode: "move"; id: string; dx: number; dy: number }
  | { mode: "resize"; id: string; s0: number; d0: number }
  | { mode: "rotate"; id: string }
  | { mode: "tail"; id: string }
  | { mode: "pan"; i: number; x0: number; y0: number; cx0: number; cy0: number; s: number }
  | { mode: "focus"; i: number };

const HISTORY = 80;

export function Editor({ id }: { id: string }) {
  const [story, setStory] = useState<Story | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageIdx, setPageIdx] = useState(0);
  const [sel, setSel] = useState<Sel>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [, setFontsTick] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const past = useRef<Story[]>([]);
  const future = useRef<Story[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const dragPointer = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<TrayTab>("add");
  const [trayOpen, setTrayOpen] = useState(false);
  useAppViewport(rootRef);
  const coarse = useCoarsePointer();

  useEffect(() => {
    api<{ story: Story }>(`/api/stories/${id}`).then((j) => setStory(j.story), (e) => setError(e.message));
    // Bubble wrapping measures text, so re-render once the lettering font is in.
    void loadPageFonts().then(() => setFontsTick((t) => t + 1));
  }, [id]);

  const { label, flush } = useAutosave(story, async (s) => {
    const j = await api<{ story: Story }>(`/api/stories/${id}`, { method: "PUT", json: s });
    // The server owns publishing fields; keep the local copy's content, take its status (only when it changed, or
    // the new object would schedule another save).
    setStory((cur) => (cur && JSON.stringify(cur.published) !== JSON.stringify(j.story.published) ? { ...cur, published: j.story.published } : cur));
  });

  const cast = useMemo(() => (story ? storyCast(story.pages) : []), [story]);
  const upp = useUnitsPerPx(svgRef, PAGE_W, !!story);
  const sheetRef = useRef<HTMLDivElement>(null);
  useCanvasTouch(sheetRef, !!story);
  const { art, missing } = useArt(cast);

  // ===== mutations =====
  // History is pushed from a ref outside the state updaters, which React may run twice in development.
  const current = useRef<Story | null>(null);
  current.current = story;
  const snapshot = useCallback(() => {
    if (!current.current) return;
    past.current.push(current.current);
    if (past.current.length > HISTORY) past.current.shift();
    future.current = [];
  }, []);
  const mutate = useCallback(
    (fn: (s: Story) => Story, record = true) => {
      if (record) snapshot();
      setStory((s) => (s ? fn(s) : s));
    },
    [snapshot],
  );
  const mutatePage = useCallback((fn: (p: Page) => Page, record = true) => mutate((s) => ({ ...s, pages: s.pages.map((p, i) => (i === pageIdx ? fn(p) : p)) }), record), [mutate, pageIdx]);
  const mutateItem = useCallback((itemId: string, fn: (it: Item) => Item, record = true) => mutatePage((p) => ({ ...p, items: p.items.map((it) => (it.id === itemId ? fn(it) : it)) }), record), [mutatePage]);
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    if (current.current) future.current.push(current.current);
    setStory({ ...prev, published: current.current?.published ?? prev.published });
  }, []);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    if (current.current) past.current.push(current.current);
    setStory({ ...next, published: current.current?.published ?? next.published });
  }, []);

  const page = story?.pages[Math.min(pageIdx, (story?.pages.length ?? 1) - 1)];
  const selItem = sel?.k === "item" ? page?.items.find((it) => it.id === sel.id) : undefined;

  // On a phone, picking something while the tray is open shows its options; a closed tray stays out of the way.
  const selKey = sel ? (sel.k === "item" ? sel.id : `panel${sel.i}`) : "";
  useEffect(() => {
    if (selKey && trayOpen) setTab("edit");
  }, [selKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const pickTab = (t: TrayTab) => {
    if (trayOpen && tab === t) setTrayOpen(false);
    else {
      setTab(t);
      setTrayOpen(true);
    }
  };

  const addItem = useCallback(
    (make: (at: { x: number; y: number; panel: number }) => Item) => {
      if (!page) return;
      if (page.items.length >= MAX_ITEMS_PER_PAGE) {
        setError(`A page holds up to ${MAX_ITEMS_PER_PAGE} things.`);
        return;
      }
      const panel = sel?.k === "panel" ? sel.i : selItem && "panel" in selItem ? selItem.panel : 0;
      const b = panelBox(page.layout, panel);
      const jitter = (page.items.length % 5) * 18;
      const it = make({ x: b.x + b.w / 2 + jitter, y: b.y + b.h / 2 + jitter, panel });
      mutatePage((p) => ({ ...p, items: [...p.items, it] }));
      setSel({ k: "item", id: it.id });
    },
    [page, sel, selItem, mutatePage],
  );
  const addFriend = (friend: FriendRef) =>
    addItem(({ x, y, panel }) => ({ id: newId(), t: "friend", x, y, rot: 0, panel, friend, size: 240, facing: "down", pose: "idle", frame: 0, flip: false, ink: "#000000", halo: true }));

  const deleteSel = useCallback(() => {
    if (sel?.k !== "item") return;
    mutatePage((p) => ({ ...p, items: p.items.filter((it) => it.id !== sel.id) }));
    setSel(null);
  }, [sel, mutatePage]);
  const duplicateSel = useCallback(() => {
    if (!selItem) return;
    const copy = { ...structuredClone(selItem), id: newId(), x: selItem.x + 30, y: selItem.y + 30 } as Item;
    if (copy.t === "bubble" && copy.tail) copy.tail = { x: copy.tail.x + 30, y: copy.tail.y + 30 };
    mutatePage((p) => ({ ...p, items: [...p.items, copy] }));
    setSel({ k: "item", id: copy.id });
  }, [selItem, mutatePage]);
  const reorder = (dir: 1 | -1) => {
    if (sel?.k !== "item") return;
    mutatePage((p) => {
      const i = p.items.findIndex((it) => it.id === sel.id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.items.length) return p;
      const items = [...p.items];
      [items[i], items[j]] = [items[j], items[i]];
      return { ...p, items };
    });
  };

  // ===== pages =====
  const addPage = () => {
    if (!story || story.pages.length >= MAX_PAGES) return;
    mutate((s) => ({ ...s, pages: [...s.pages.slice(0, pageIdx + 1), newPage(), ...s.pages.slice(pageIdx + 1)] }));
    setPageIdx(pageIdx + 1);
    setSel(null);
  };
  const dupPage = () => {
    if (!story || !page || story.pages.length >= MAX_PAGES) return;
    const copy: Page = { ...structuredClone(page), items: page.items.map((it) => ({ ...structuredClone(it), id: newId() })) };
    mutate((s) => ({ ...s, pages: [...s.pages.slice(0, pageIdx + 1), copy, ...s.pages.slice(pageIdx + 1)] }));
    setPageIdx(pageIdx + 1);
  };
  const delPage = () => {
    if (!story || story.pages.length <= 1) return;
    if (!confirm(`Delete page ${pageIdx + 1}?`)) return;
    mutate((s) => ({ ...s, pages: s.pages.filter((_, i) => i !== pageIdx) }));
    setPageIdx(Math.max(0, pageIdx - 1));
    setSel(null);
  };
  const movePage = (dir: 1 | -1) => {
    const j = pageIdx + dir;
    if (!story || j < 0 || j >= story.pages.length) return;
    mutate((s) => {
      const pages = [...s.pages];
      [pages[pageIdx], pages[j]] = [pages[j], pages[pageIdx]];
      return { ...s, pages };
    });
    setPageIdx(j);
  };

  // ===== keyboard =====
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSel();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (sel?.k === "item") {
          e.preventDefault();
          deleteSel();
        }
      } else if (e.key === "Escape") setSel(null);
      else if (sel?.k === "item" && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 20 : 4;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        mutateItem(sel.id, (it) => ({ ...it, x: it.x + dx, y: it.y + dy }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, undo, redo, deleteSel, duplicateSel, mutateItem]);

  // ===== selection box =====
  useLayoutEffect(() => {
    if (sel?.k !== "item" || !svgRef.current) {
      setBox(null);
      return;
    }
    const el = svgRef.current.querySelector(`[data-item="${sel.id}"]`) as SVGGraphicsElement | null;
    if (!el) {
      setBox(null);
      return;
    }
    const b = el.getBBox();
    setBox((cur) => (cur && cur.x === b.x && cur.y === b.y && cur.w === b.width && cur.h === b.height ? cur : { x: b.x, y: b.y, w: b.width, h: b.height }));
  }, [sel, story, pageIdx, art]);

  // ===== pointer =====
  const toPage = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const q = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: q.x, y: q.y };
  };
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!page || e.button !== 0 || drag.current) return;
    const target = e.target as Element;
    const p = toPage(e);
    const handle = target.closest("[data-handle]")?.getAttribute("data-handle");
    const itemEl = target.closest("[data-item]");
    const panelEl = target.closest("[data-panel]");
    if (handle && selItem) {
      snapshot();
      if (handle === "resize") drag.current = { mode: "resize", id: selItem.id, s0: sizeOf(selItem), d0: Math.max(10, Math.hypot(p.x - selItem.x, p.y - selItem.y)) };
      else if (handle === "rotate") drag.current = { mode: "rotate", id: selItem.id };
      else if (handle === "tail") drag.current = { mode: "tail", id: selItem.id };
    } else if (itemEl) {
      const itemId = itemEl.getAttribute("data-item")!;
      const it = page.items.find((x) => x.id === itemId);
      if (!it) return;
      setSel({ k: "item", id: itemId });
      snapshot();
      drag.current = { mode: "move", id: itemId, dx: it.x - p.x, dy: it.y - p.y };
    } else if (panelEl) {
      const i = Number(panelEl.getAttribute("data-panel"));
      setSel({ k: "panel", i });
      const bg = page.panels[i]?.bg;
      if (bg?.kind === "world") {
        snapshot();
        const b = panelBox(page.layout, i);
        drag.current = { mode: "pan", i, x0: p.x, y0: p.y, cx0: bg.cx, cy0: bg.cy, s: Math.max(b.w / 1600, b.h / 1200) * bg.zoom };
      } else if (bg?.kind === "tone" && bg.tone === "focus") {
        snapshot();
        drag.current = { mode: "focus", i };
      }
    } else setSel(null);
    if (drag.current) {
      // One finger drives a drag; a second one landing mid-drag is ignored.
      dragPointer.current = e.pointerId;
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !page || e.pointerId !== dragPointer.current) return;
    const p = toPage(e);
    switch (d.mode) {
      case "move":
        mutateItem(
          d.id,
          (it) => {
            const x = Math.round(p.x + d.dx);
            const y = Math.round(p.y + d.dy);
            const dx = x - it.x;
            const dy = y - it.y;
            // Friends and props belong to the panel they are dropped in; a bubble's tail travels with it.
            if (it.t === "friend" || it.t === "prop") return { ...it, x, y, panel: panelAt(page.layout, x, y) };
            if (it.t === "bubble" && it.tail) return { ...it, x, y, tail: { x: it.tail.x + dx, y: it.tail.y + dy } };
            return { ...it, x, y };
          },
          false,
        );
        break;
      case "resize":
        mutateItem(d.id, (it) => withSize(it, Math.round((d.s0 * Math.hypot(p.x - it.x, p.y - it.y)) / d.d0)), false);
        break;
      case "rotate":
        mutateItem(
          d.id,
          (it) => {
            let rot = (Math.atan2(p.y - it.y, p.x - it.x) * 180) / Math.PI + 90;
            if (rot > 180) rot -= 360;
            if (Math.abs(rot) < 4) rot = 0;
            return { ...it, rot: Math.round(rot) };
          },
          false,
        );
        break;
      case "tail":
        mutateItem(d.id, (it) => (it.t === "bubble" ? { ...it, tail: { x: Math.round(p.x), y: Math.round(p.y) } } : it), false);
        break;
      case "pan": {
        const cx = Math.max(0, Math.min(1600, d.cx0 - (p.x - d.x0) / d.s));
        const cy = Math.max(0, Math.min(1200, d.cy0 - (p.y - d.y0) / d.s));
        mutatePage((pg) => ({ ...pg, panels: pg.panels.map((pn, i) => (i === d.i && pn.bg.kind === "world" ? { bg: { ...pn.bg, cx, cy } } : pn)) }), false);
        break;
      }
      case "focus": {
        const b = panelBox(page.layout, d.i);
        const fx = Math.max(0, Math.min(1, (p.x - b.x) / b.w));
        const fy = Math.max(0, Math.min(1, (p.y - b.y) / b.h));
        mutatePage((pg) => ({ ...pg, panels: pg.panels.map((pn, i) => (i === d.i && pn.bg.kind === "tone" ? { bg: { ...pn.bg, focusX: fx, focusY: fy } } : pn)) }), false);
        break;
      }
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerId !== dragPointer.current) return;
    drag.current = null;
    dragPointer.current = null;
  };
  const onWheel = (e: React.WheelEvent) => {
    if (!page || sel?.k !== "panel") return;
    const bg = page.panels[sel.i]?.bg;
    if (bg?.kind !== "world") return;
    const zoom = Math.max(0.5, Math.min(6, bg.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
    mutatePage((pg) => ({ ...pg, panels: pg.panels.map((pn, i) => (i === sel.i && pn.bg.kind === "world" ? { bg: { ...pn.bg, zoom } } : pn)) }), false);
  };

  if (error && !story) return <div className="wrap"><div className="err">{error}</div></div>;
  if (!story || !page) return <div className="wrap" style={{ padding: 60 }}><span className="px">OPENING THE STUDIO…</span></div>;

  const tail = selItem?.t === "bubble" && selItem.tail && selItem.style !== "box" ? selItem.tail : null;
  const selPanel = sel?.k === "panel" ? panelBox(page.layout, sel.i) : null;
  // Handles keep a finger-sized target (44px) on touch screens, however small the page is drawn.
  const hr = Math.max(11, 9 * upp);
  const hit = coarse ? Math.max(hr, 22 * upp) : hr;
  const stem = Math.max(34, 24 * upp);
  const goPage = (i: number) => {
    setPageIdx(i);
    setSel(null);
  };

  return (
    <div className="editor app" ref={rootRef}>
      <div className="editor-bar">
        <Link href="/studio" className="btn small" aria-label="Back to the Studio">←<span className="desk-only">&nbsp;Studio</span></Link>
        <input className="title" value={story.title} maxLength={80} onChange={(e) => mutate((s) => ({ ...s, title: e.target.value }), false)} aria-label="Manga title" />
        <div className="toggle desk-only" role="group" aria-label="Colour mode">
          <button aria-pressed={!story.color} onClick={() => mutate((s) => ({ ...s, color: false }))}>B&amp;W</button>
          <button aria-pressed={story.color} className="color-on" onClick={() => mutate((s) => ({ ...s, color: true }))}>Colour</button>
        </div>
        <button className="btn small ghost icon-sm" onClick={undo} disabled={!past.current.length} title="Undo (Ctrl+Z)" aria-label="Undo">
          <span className="phone-only" aria-hidden>↶</span>
          <span className="desk-only">Undo</span>
        </button>
        <button className="btn small ghost icon-sm" onClick={redo} disabled={!future.current.length} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
          <span className="phone-only" aria-hidden>↷</span>
          <span className="desk-only">Redo</span>
        </button>
        <span className="spacer desk-only" />
        <span className="status desk-only" aria-live="polite">{label}</span>
        {story.published ? <Link className="btn small desk-only" href={`/read/${story.published.slug}`} target="_blank">View live</Link> : null}
        <button className="btn dark" onClick={() => void flush().then(() => setPublishing(true))}>{story.published ? "Republish" : "Publish"}</button>
      </div>
      <div className="editor-body" data-tray={trayOpen ? "open" : "closed"}>
        <nav className="rail" aria-label="Pages">
          {story.pages.map((p, i) => (
            <button key={i} className="pg" aria-current={i === pageIdx} onClick={() => goPage(i)} aria-label={`Page ${i + 1}`}>
              <span className="num">{i + 1}</span>
              <PageSvg page={p} color={story.color} art={art} uid={`r${i}`} />
            </button>
          ))}
          <button className="btn small" onClick={addPage} disabled={story.pages.length >= MAX_PAGES}>+ Page</button>
        </nav>
        <div className="stage" onWheel={onWheel}>
          <div className="sheet page-sheet" ref={sheetRef} onPointerDown
={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            <PageSvg page={page} color={story.color} art={art} uid="live" svgRef={svgRef} title={`Page ${pageIdx + 1}`}>
              <g data-editor="1">
                {selPanel ? <rect x={selPanel.x} y={selPanel.y} width={selPanel.w} height={selPanel.h} fill="none" stroke="#CCFF00" strokeWidth={8} strokeDasharray="18 10" pointerEvents="none" /> : null}
                {box && selItem ? (
                  <>
                    <rect x={box.x - 6} y={box.y - 6} width={box.w + 12} height={box.h + 12} fill="none" stroke="#000" strokeWidth={2} strokeDasharray="8 6" pointerEvents="none" />
                    <line x1={box.x + box.w / 2} y1={box.y - 6} x2={box.x + box.w / 2} y2={box.y - 6 - stem} stroke="#000" strokeWidth={2} pointerEvents="none" />
                    <g data-handle="rotate" style={{ cursor: "grab" }}>
                      <circle cx={box.x + box.w / 2} cy={box.y - 6 - stem - hr} r={hit} fill="transparent" />
                      <circle cx={box.x + box.w / 2} cy={box.y - 6 - stem - hr} r={hr} fill="#fff" stroke="#000" strokeWidth={3} />
                    </g>
                    <g data-handle="resize" style={{ cursor: "nwse-resize" }}>
                      <rect x={box.x + box.w + 5 - hit} y={box.y + box.h + 5 - hit} width={hit * 2} height={hit * 2} fill="transparent" />
                      <rect x={box.x + box.w + 5 - hr} y={box.y + box.h + 5 - hr} width={hr * 2} height={hr * 2} fill="#CCFF00" stroke="#000" strokeWidth={3} />
                    </g>
                  </>
                ) : null}
                {tail ? (
                  <g data-handle="tail" style={{ cursor: "move" }}>
                    <circle cx={tail.x} cy={tail.y} r={hit} fill="transparent" />
                    <circle cx={tail.x} cy={tail.y} r={hr} fill="#CCFF00" stroke="#000" strokeWidth={3} />
                  </g>
                ) : null}
              </g>
            </PageSvg>
          </div>
        </div>
        <div className="pager phone-only">
          <button className="btn small" onClick={() => goPage(pageIdx - 1)} disabled={pageIdx === 0} aria-label="Previous page">‹</button>
          <span className="px pager-n" aria-label={`Page ${pageIdx + 1} of ${story.pages.length}`}>{pageIdx + 1}/{story.pages.length}</span>
          <button className="btn small" onClick={() => goPage(pageIdx + 1)} disabled={pageIdx >= story.pages.length - 1} aria-label="Next page">›</button>
          <span className="status" aria-live="polite">{label}</span>
          {selItem ? (
            <>
              <button className="btn small" onClick={duplicateSel} aria-label="Duplicate">⧉</button>
              <button className="btn small danger" onClick={deleteSel} aria-label="Delete">✕</button>
            </>
          ) : (
            <button className="btn small" onClick={addPage} disabled={story.pages.length >= MAX_PAGES}>+ Page</button>
          )}
        </div>
        <div className="tray-tabs phone-only" role="tablist" aria-label="Tools">
          {TRAY_TABS.map(([t, name]) => (
            <button key={t} role="tab" aria-selected={trayOpen && tab === t} onClick={() => pickTab(t)}>
              {name}
              {t === "edit" && sel ? <i className="dot" aria-hidden /> : null}
            </button>
          ))}
        </div>
        <Inspector
          tab={tab}
          story={story}
          page={page}
          pageIdx={pageIdx}
          sel={sel}
          selItem={selItem}
          art={art}
          missing={missing}
          mutate={mutate}
          mutatePage={mutatePage}
          mutateItem={mutateItem}
          addItem={addItem}
          addFriend={addFriend}
          deleteSel={deleteSel}
          duplicateSel={duplicateSel}
          reorder={reorder}
          pageActions={{ addPage, dupPage, delPage, movePage, goPage }}
          setSel={setSel}
          svgRef={svgRef}
          coarse={coarse}
        />
      </div>
      {error ? (
        <div className="err toast" role="alert" onClick={() => setError(null)}>
          {error}
        </div>
      ) : null}
      {publishing ? <PublishModal story={story} onClose={() => setPublishing(false)} onPublished={(published) => setStory((s) => (s ? { ...s, published } : s))} /> : null}
    </div>
  );
}
