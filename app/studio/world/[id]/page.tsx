"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getWorldPreset, project, unproject } from "@rarefriends/friendsdk/world";
import { FriendIcon, FriendPicker } from "@/components/FriendPicker";
import { Gate } from "@/components/Gate";
import { onGround, propImage, worldImage } from "@/components/render/worlds";
import { useArt } from "@/components/useArt";
import { useAppViewport, useCanvasTouch, useCoarsePointer, useUnitsPerPx } from "@/components/useAppViewport";
import { useAutosave } from "@/components/useAutosave";
import { api } from "@/components/useSession";
import { FACINGS, friendKey, MAX_WORLD_CAST, MAX_WORLD_PROPS, PROP_TYPES, WORLD_BASES, type FriendRef, type WorldBaseId, type WorldDoc } from "@/lib/model";

type Sel = { kind: "prop" | "cast"; i: number } | null;
type Tab = "world" | "props" | "cast" | "edit";
const TABS: [Tab, string][] = [["world", "World"], ["props", "Props"], ["cast", "Friends"], ["edit", "Edit"]];
const HISTORY = 60;

/** The part of the SDK's 1600 x 1200 canvas a base world occupies, with headroom for tall props. */
function viewBoxFor(base: WorldBaseId) {
  const w = getWorldPreset(base);
  const pts = w.geometry.polygons.flat().map(([x, y]) => project(x, y));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs) - 90;
  const y0 = Math.min(...ys) - 230;
  return { x: x0, y: y0, w: Math.max(...xs) + 90 - x0, h: Math.max(...ys) + 90 - y0 };
}

/** A starting spot on the ground: the preset's first composition anchor, or its first polygon's centre. */
function groundSpot(base: WorldBaseId, n: number): [number, number] {
  const w = getWorldPreset(base);
  const a = w.actors[n % Math.max(1, w.actors.length)];
  if (a && onGround(base, a.x, a.y)) return [a.x, a.y];
  const poly = w.geometry.polygons[0];
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  return [cx, cy];
}

function Builder({ id }: { id: string }) {
  const [world, setWorld] = useState<WorldDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<Sel>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: "prop" | "cast"; i: number; dx: number; dy: number; pointer: number; moved: boolean } | null>(null);
  const past = useRef<WorldDoc[]>([]);
  const current = useRef<WorldDoc | null>(null);
  current.current = world;
  const [, setUndoTick] = useState(0);
  const [tab, setTab] = useState<Tab>("world");
  const [trayOpen, setTrayOpen] = useState(true);
  useAppViewport(rootRef);
  const coarse = useCoarsePointer();

  useEffect(() => {
    api<{ world: WorldDoc }>(`/api/worlds/${id}`).then((j) => setWorld(j.world), (e) => setError(e.message));
  }, [id]);
  const { label } = useAutosave(world, async (w) => void (await api(`/api/worlds/${id}`, { method: "PUT", json: w })));
  const { art } = useArt(world?.scene.cast.map((c) => c.friend) ?? []);

  const update = useCallback((fn: (w: WorldDoc) => WorldDoc) => setWorld((w) => (w ? fn(w) : w)), []);
  // History is pushed from a ref outside the state updaters, which React may run twice in development.
  const snapshot = useCallback(() => {
    if (!current.current) return;
    past.current.push(current.current);
    if (past.current.length > HISTORY) past.current.shift();
    setUndoTick((t) => t + 1);
  }, []);
  const record = useCallback((fn: (w: WorldDoc) => WorldDoc) => {
    snapshot();
    update(fn);
  }, [snapshot, update]);
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    setWorld(prev);
    setSel(null);
    setUndoTick((t) => t + 1);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);
  const selKey = sel ? `${sel.kind}${sel.i}` : "";
  useEffect(() => {
    if (selKey && trayOpen) setTab("edit");
  }, [selKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const pickTab = (t: Tab) => {
    if (trayOpen && tab === t) setTrayOpen(false);
    else {
      setTab(t);
      setTrayOpen(true);
    }
  };
  const vb = useMemo(() => (world ? viewBoxFor(world.scene.base) : null), [world?.scene.base]); // eslint-disable-line react-hooks/exhaustive-deps
  const upp = useUnitsPerPx(svgRef, vb?.w ?? 1, vb);
  useCanvasTouch(svgRef, vb);


  const toSvg = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const q = p.matrixTransform(svg.getScreenCTM()!.inverse());
    return [q.x, q.y] as [number, number];
  };

  if (error) return <div className="wrap"><div className="err">{error}</div></div>;
  if (!world || !vb) return <div className="wrap" style={{ padding: 60 }}><span className="px">LOADING WORLD…</span></div>;

  const { scene } = world;
  const handles = [
    ...scene.props.map((p, i) => ({ kind: "prop" as const, i, x: p.x, y: p.y })),
    ...scene.cast.map((c, i) => ({ kind: "cast" as const, i, x: c.x, y: c.y })),
  ];

  // Hit radius in world units: 60, or about a fingertip (26px) when the world is drawn small on a phone.
  const reach = Math.max(60, (coarse ? 26 : 16) * upp);
  const onDown = (e: React.PointerEvent) => {
    if (drag.current) return;
    const [sx, sy] = toSvg(e);
    let best: { kind: "prop" | "cast"; i: number; d: number; dx: number; dy: number } | null = null;
    for (const h of handles) {
      const [hx, hy] = project(h.x, h.y);
      // Hit area: the ground anchor and the body above it (props and Friends stand up from their anchor).
      const d = Math.hypot(sx - hx, Math.max(0, sy - hy) + Math.max(0, hy - 110 - sy) * 0.4);
      // When things overlap, the selected one wins, then whatever is listed later (Friends over props).
      const score = sel?.kind === h.kind && sel.i === h.i ? d * 0.5 : d;
      if (d < reach && (!best || score <= best.d)) best = { kind: h.kind, i: h.i, d: score, dx: hx - sx, dy: hy - sy };
    }
    if (!best) {
      setSel(null);
      return;
    }
    setSel({ kind: best.kind, i: best.i });
    drag.current = { kind: best.kind, i: best.i, dx: best.dx, dy: best.dy, pointer: e.pointerId, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointer) return;
    const [sx, sy] = toSvg(e);
    const [x, y] = unproject(sx + d.dx, sy + d.dy);
    if (!onGround(scene.base, x, y)) return;
    // Only a real move goes into the undo history, not a tap that just selects.
    if (!d.moved) {
      d.moved = true;
      snapshot();
    }
    update((w) => {
      const s = { ...w.scene };
      if (d.kind === "prop") s.props = s.props.map((p, i) => (i === d.i ? { ...p, x, y } : p));
      else s.cast = s.cast.map((c, i) => (i === d.i ? { ...c, x, y } : c));
      return { ...w, scene: s };
    });
  };
  const onUp = (e: React.PointerEvent) => {
    if (drag.current?.pointer === e.pointerId) drag.current = null;
  };

  const addProp = (type: (typeof PROP_TYPES)[number]) => {
    if (scene.props.length >= MAX_WORLD_PROPS) return;
    const [x, y] = groundSpot(scene.base, scene.props.length);
    record((w) => ({ ...w, scene: { ...w.scene, props: [...w.scene.props, { type, x, y, scale: 1 }] } }));
    setSel({ kind: "prop", i: scene.props.length });
  };
  const addCast = (friend: FriendRef) => {
    if (scene.cast.length >= MAX_WORLD_CAST) return;
    const [x, y] = groundSpot(scene.base, scene.cast.length + 1);
    record((w) => ({ ...w, scene: { ...w.scene, cast: [...w.scene.cast, { friend, x, y, facing: "down", pose: "idle", frame: 0, scale: 4 }] } }));
    setSel({ kind: "cast", i: scene.cast.length });
  };
  const setBase = (base: WorldBaseId) => {
    // Props and Friends that would fall off the new terrain move to its starting spots.
    record((w) => ({
      ...w,
      scene: {
        base,
        props: w.scene.props.map((p, i) => {
          if (onGround(base, p.x, p.y)) return p;
          const [x, y] = groundSpot(base, i);
          return { ...p, x, y };
        }),
        cast: w.scene.cast.map((c, i) => {
          if (onGround(base, c.x, c.y)) return c;
          const [x, y] = groundSpot(base, i + 1);
          return { ...c, x, y };
        }),
      },
    }));
  };
  const remove = () => {
    if (!sel) return;
    record((w) => ({ ...w, scene: { ...w.scene, [sel.kind === "prop" ? "props" : "cast"]: (sel.kind === "prop" ? w.scene.props : w.scene.cast).filter((_, i) => i !== sel.i) } }));
    setSel(null);
  };

  const selProp = sel?.kind === "prop" ? scene.props[sel.i] : undefined;
  const selCast = sel?.kind === "cast" ? scene.cast[sel.i] : undefined;
  const setCast = (patch: Partial<WorldDoc["scene"]["cast"][number]>, rec = true) => (rec ? record : update)((w) => ({ ...w, scene: { ...w.scene, cast: w.scene.cast.map((c, i) => (sel?.kind === "cast" && i === sel.i ? { ...c, ...patch } : c)) } }));
  const setProp = (patch: Partial<WorldDoc["scene"]["props"][number]>, rec = true) => (rec ? record : update)((w) => ({ ...w, scene: { ...w.scene, props: w.scene.props.map((p, i) => (sel?.kind === "prop" && i === sel.i ? { ...p, ...patch } : p)) } }));

  return (
    <div className="editor app world-app" ref={rootRef}>
      <div className="editor-bar">
        <Link href="/studio?tab=worlds" className="btn small" aria-label="Back to your worlds">←<span className="desk-only">&nbsp;Worlds</span></Link>
        <input className="title" value={world.name} maxLength={60} onChange={(e) => update((w) => ({ ...w, name: e.target.value }))} aria-label="World name" />
        <div className="toggle" role="group" aria-label="Colour mode">
          <button aria-pressed={!world.color} onClick={() => record((w) => ({ ...w, color: false }))}>B&amp;W</button>
          <button aria-pressed={world.color} className="color-on" onClick={() => record((w) => ({ ...w, color: true }))}>Colour</button>
        </div>
        <button className="btn small ghost icon-sm" onClick={undo} disabled={!past.current.length} title="Undo (Ctrl+Z)" aria-label="Undo">
          <span className="phone-only" aria-hidden>↶</span>
          <span className="desk-only">Undo</span>
        </button>
        <span className="spacer desk-only" />
        <span className="status desk-only">{label}</span>
      </div>
      <div className="editor-body world-body" data-tray={trayOpen ? "open" : "closed"}>
        <div className="stage" style={{ alignItems: "center" }}>
          <div className="wb-stage" style={{ "--ar": vb.w / vb.h } as React.CSSProperties}>
            <svg
              ref={svgRef}
              viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              role="application"
              aria-label="World canvas. Drag props and Friends to move them."
            >
              <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="#fff" />
              <image href={worldImage(scene, world.color, art)} x={0} y={0} width={1600} height={1200} />
              {handles.map((h) => {
                const [x, y] = project(h.x, h.y);
                const on = sel?.kind === h.kind && sel.i === h.i;
                return (
                  <g key={`${h.kind}${h.i}`} pointerEvents="none">
                    <ellipse cx={x} cy={y} rx={on ? 26 : 14} ry={on ? 9 : 5} fill={on ? "#CCFF00" : "none"} stroke="#000" strokeWidth={on ? 3 : 1.5} strokeDasharray={on ? undefined : "4 3"} opacity={on ? 0.9 : 0.6} />
                  </g>
                );
              })}
            </svg>
          </div>
          <p className="hint wb-hint">Drag props and Friends. They stay on the ground and sort in depth automatically.</p>
          <span className="status phone-only wb-status">{label}</span>
        </div>
        <div className="tray-tabs phone-only" role="tablist" aria-label="Tools">
          {TABS.map(([t, name]) => (
            <button key={t} role="tab" aria-selected={trayOpen && tab === t} onClick={() => pickTab(t)}>
              {name}
              {t === "edit" && sel ? <i className="dot" aria-hidden /> : null}
            </button>
          ))}
        </div>
        <aside className="inspector" data-tab={tab}>
          {sel && (selProp || selCast) ? (
            <div className="panel-sec" data-sec="edit" style={{ background: "#CCFF00" }}>
              <h4>
                <span>{selProp ? `PROP · ${selProp.type.toUpperCase()}` : `FRIEND · ${selCast!.friend.c.toUpperCase()} #${selCast!.friend.id}`}</span>
                <button className="btn small danger" onClick={remove}>Remove</button>
              </h4>
              {selProp ? (
                <label className="field">
                  <span>Size</span>
                  <input type="range" min={0.4} max={2.5} step={0.05} value={selProp.scale} onPointerDown={snapshot} onChange={(e) => setProp({ scale: +e.target.value }, false)} />
                </label>
              ) : null}
              {selCast ? (
                <>
                  <label className="field">
                    <span>Size</span>
                    <input type="range" min={2} max={8} step={1} value={selCast.scale} onPointerDown={snapshot} onChange={(e) => setCast({ scale: +e.target.value }, false)} />
                  </label>
                  <div className="field">
                    <span>Facing</span>
                    <div className="grid-btns four">
                      {FACINGS.map((f) => (
                        <button key={f} className="tile" aria-pressed={selCast.facing === f} onClick={() => setCast({ facing: f })}>{f}</button>
                      ))}
                    </div>
                  </div>
                  <div className="field">
                    <span>Pose</span>
                    <div className="grid-btns two">
                      <button className="tile" aria-pressed={selCast.pose === "idle"} onClick={() => setCast({ pose: "idle" })}>Idle</button>
                      <button className="tile" aria-pressed={selCast.pose === "walk"} onClick={() => setCast({ pose: "walk" })}>Walking</button>
                    </div>
                  </div>
                  <label className="field">
                    <span>Frame {selCast.frame + 1} of 8</span>
                    <input type="range" min={0} max={7} step={1} value={selCast.frame} onPointerDown={snapshot} onChange={(e) => setCast({ frame: +e.target.value }, false)} />
                  </label>
                </>
              ) : null}
            </div>
          ) : (
            <div className="panel-sec phone-only" data-sec="edit">
              <p className="hint" style={{ marginTop: 0 }}>Tap a prop or a Friend in the world to move, resize or remove it.</p>
            </div>
          )}
          <div className="panel-sec" data-sec="world">
            <h4>BASE WORLD · FRIENDSDK</h4>
            <div className="grid-btns two">
              {WORLD_BASES.map((b) => (
                <button key={b.id} className="tile" aria-pressed={scene.base === b.id} onClick={() => setBase(b.id)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={worldImage({ base: b.id, props: [], cast: [] }, world.color, art)} alt="" style={{ transform: "scale(1.9)", height: 56 }} />
                  {b.name}
                </button>
              ))}
            </div>
          </div>
          <div className="panel-sec" data-sec="props">
            <h4>
              <span>ADD PROPS</span>
              <span className="mute">{scene.props.length}/{MAX_WORLD_PROPS}</span>
            </h4>
            <div className="grid-btns four">
              {PROP_TYPES.map((t) => (
                <button key={t} className="tile" onClick={() => addProp(t)} aria-label={`Add ${t}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={propImage(t, world.color)} alt="" style={{ height: 44, transform: "scale(1.6) translateY(-4px)" }} />
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="panel-sec" data-sec="cast">
            <h4>
              <span>CAST FRIENDS</span>
              <span className="mute">{scene.cast.length}/{MAX_WORLD_CAST}</span>
            </h4>
            {scene.cast.length ? (
              <div className="cast" style={{ marginBottom: 10 }}>
                {scene.cast.map((c, i) => (
                  <button key={i} className="tile" aria-pressed={sel?.kind === "cast" && sel.i === i} onClick={() => setSel({ kind: "cast", i })}>
                    <FriendIcon art={art.get(friendKey(c.friend))} />
                    <span>#{c.friend.id}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <FriendPicker onPick={addCast} label="Walk into the world" />
          </div>
          <div className="panel-sec" data-sec="world">
            <p className="hint" style={{ marginTop: 0 }}>This world is saved to your studio. In the manga editor, pick any panel and choose <b>World</b> to frame a shot of it. Each page keeps its own copy, so editing the world later never changes a published issue.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function WorldPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Gate>
      <Builder id={id} />
    </Gate>
  );
}
