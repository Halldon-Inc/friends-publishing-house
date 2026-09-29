"use client";
import { useEffect, useState, type RefObject } from "react";
import { FriendIcon, FriendPicker } from "@/components/FriendPicker";
import { EmoteArt } from "@/components/render/PageSvg";
import { fitWorld, propImage, worldImage } from "@/components/render/worlds";
import { api } from "@/components/useSession";
import type { FriendArt } from "@/lib/art";
import {
  BUBBLE_STYLES,
  EMOTES,
  FACINGS,
  friendKey,
  INKS,
  LAYOUT_IDS,
  LAYOUTS,
  newId,
  PAPERS,
  panelBox,
  PROP_TYPES,
  relayout,
  TONES,
  toneBg,
  WORLD_BASES,
  worldBg,
  type BubbleStyle,
  type FriendRef,
  type Item,
  type Page,
  type PanelBg,
  type Story,
  type Tone,
  type WorldDoc,
} from "@/lib/model";
import { LayoutIcon } from "./LayoutIcon";
import type { Sel } from "./Editor";

type Props = {
  story: Story;
  page: Page;
  pageIdx: number;
  sel: Sel;
  selItem: Item | undefined;
  art: Map<string, FriendArt>;
  missing: string[];
  mutate(fn: (s: Story) => Story, record?: boolean): void;
  mutatePage(fn: (p: Page) => Page, record?: boolean): void;
  mutateItem(id: string, fn: (it: Item) => Item, record?: boolean): void;
  addItem(make: (at: { x: number; y: number; panel: number }) => Item): void;
  addFriend(f: FriendRef): void;
  deleteSel(): void;
  duplicateSel(): void;
  reorder(dir: 1 | -1): void;
  pageActions: { addPage(): void; dupPage(): void; delPage(): void; movePage(d: 1 | -1): void };
  setSel(s: Sel): void;
  svgRef: RefObject<SVGSVGElement | null>;
};

const SFX_PRESETS = ["BAM!", "DOKI DOKI", "GOGOGO", "ZOOOM", "KRAK!", "SHING", "WAAAH", "GM", "LFG", "WAGMI", "NGMI", "!?"];
const TONE_NAMES: Record<Tone, string> = { white: "Paper", black: "Ink", dots: "Screentone", dense: "Heavy tone", lines: "Hatching", cross: "Crosshatch", speed: "Speed lines", focus: "Focus lines", sparkle: "Sparkles", fade: "Gradient" };

function Swatches({ list, value, onPick, color }: { list: readonly string[]; value: string; onPick(v: string): void; color: boolean }) {
  const shown = color ? list : list.filter((c) => c === "#000000" || c === "#FFFFFF");
  return (
    <div className="swatches">
      {shown.map((c) => (
        <button key={c} className="swatch" style={{ background: c }} aria-pressed={value.toUpperCase() === c} aria-label={c} onClick={() => onPick(c)} />
      ))}
    </div>
  );
}

function ToneTile({ tone }: { tone: Tone }) {
  const fills: Record<Tone, React.ReactNode> = {
    white: null,
    black: <rect width="40" height="28" fill="#000" />,
    dots: <rect width="40" height="28" fill="url(#ti-dots)" />,
    dense: <rect width="40" height="28" fill="url(#ti-dense)" />,
    lines: <rect width="40" height="28" fill="url(#ti-lines)" />,
    cross: <rect width="40" height="28" fill="url(#ti-cross)" />,
    speed: <path d="M0 5h30M8 10h32M0 15h24M12 20h28M2 25h20" stroke="#000" strokeWidth="1.6" />,
    focus: <path d="M20 14L0 0M20 14L40 0M20 14L0 28M20 14L40 28M20 14L20 0M20 14L20 28M20 14L0 14M20 14L40 14" stroke="#000" strokeWidth="1.4" strokeDasharray="0 7 20" />,
    sparkle: <path d="M12 4Q12 12 20 12Q12 12 12 20Q12 12 4 12Q12 12 12 4ZM30 14Q30 19 35 19Q30 19 30 24Q30 19 25 19Q30 19 30 14Z" fill="#000" />,
    fade: <rect width="40" height="28" fill="url(#ti-fade)" />,
  };
  return (
    <svg viewBox="0 0 40 28" style={{ height: 28 }} aria-hidden>
      <defs>
        <pattern id="ti-dots" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.9" /></pattern>
        <pattern id="ti-dense" width="3.5" height="3.5" patternUnits="userSpaceOnUse"><circle cx="1.75" cy="1.75" r="1.4" /></pattern>
        <pattern id="ti-lines" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><rect width="4" height="1" /></pattern>
        <pattern id="ti-cross" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><rect width="4" height="0.8" /><rect width="0.8" height="4" /></pattern>
        <linearGradient id="ti-fade" x2="0" y2="1"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#555" /></linearGradient>
      </defs>
      <rect width="40" height="28" fill="#fff" />
      {fills[tone]}
    </svg>
  );
}

let worldsCache: WorldDoc[] | null = null;

function PanelInspector({ story, page, i, mutatePage, art }: { story: Story; page: Page; i: number; mutatePage: Props["mutatePage"]; art: Map<string, FriendArt> }) {
  const bg = page.panels[i]?.bg;
  const [worlds, setWorlds] = useState<WorldDoc[] | null>(worldsCache);
  useEffect(() => {
    if (worldsCache) return;
    api<{ worlds: WorldDoc[] }>("/api/worlds").then((j) => {
      worldsCache = j.worlds;
      setWorlds(j.worlds);
    }, () => setWorlds([]));
  }, []);
  if (!bg) return null;
  const box = panelBox(page.layout, i);
  const framed = (scene: WorldDoc["scene"]) => fitWorld(scene.base, box);
  const setBg = (next: PanelBg, record = true) => mutatePage((p) => ({ ...p, panels: p.panels.map((pn, k) => (k === i ? { bg: next } : pn)) }), record);
  return (
    <div className="panel-sec" style={{ background: "#f7ffd6" }}>
      <h4>
        <span>PANEL {i + 1}</span>
        <div className="toggle" role="group" aria-label="Panel background">
          <button aria-pressed={bg.kind === "tone"} onClick={() => bg.kind !== "tone" && setBg(toneBg(bg.tone === "none" ? "white" : bg.tone))}>Tone</button>
          <button aria-pressed={bg.kind === "world"} onClick={() => bg.kind !== "world" && setBg({ ...worldBg({ base: "01-garden-oval-complete", props: [], cast: [] }, "Garden Commons"), ...fitWorld("01-garden-oval-complete", box) })}>World</button>
        </div>
      </h4>
      {bg.kind === "tone" ? (
        <>
          <div className="grid-btns">
            {TONES.map((t) => (
              <button key={t} className="tile" aria-pressed={bg.tone === t} onClick={() => setBg({ ...bg, tone: t })}>
                <ToneTile tone={t} />
                {TONE_NAMES[t]}
              </button>
            ))}
          </div>
          {bg.tone !== "black" ? (
            <div className="field" style={{ marginTop: 10 }}>
              <span>Paper {story.color ? "" : "(colour mode adds more)"}</span>
              <Swatches list={PAPERS} value={bg.paper} onPick={(paper) => setBg({ ...bg, paper })} color={story.color} />
            </div>
          ) : null}
          {bg.tone === "focus" ? <p className="hint">Drag inside the panel to aim the focus lines.</p> : null}
        </>
      ) : (
        <>
          <div className="field">
            <span>Your worlds</span>
            {worlds === null ? <p className="hint">Loading…</p> : null}
            {worlds && !worlds.length ? <p className="hint">No worlds yet. Build one from the Studio (New world), or start from a FriendSDK world below.</p> : null}
            <div className="grid-btns two">
              {(worlds ?? []).map((w) => (
                <button key={w.id} className="tile" onClick={() => setBg({ ...bg, scene: structuredClone(w.scene), worldName: w.name, ...framed(w.scene) })}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={worldImage(w.scene, story.color, art)} alt="" style={{ transform: "scale(1.8)", height: 50 }} />
                  {w.name}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>FriendSDK worlds</span>
            <div className="grid-btns">
              {WORLD_BASES.map((b) => (
                <button key={b.id} className="tile" aria-pressed={bg.worldName === b.name && !bg.scene.props.length && bg.scene.base === b.id} onClick={() => setBg({ ...bg, scene: { base: b.id, props: [], cast: [] }, worldName: b.name, ...fitWorld(b.id, box) })}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={worldImage({ base: b.id, props: [], cast: [] }, story.color, art)} alt="" style={{ transform: "scale(1.9)", height: 40 }} />
                  {b.name}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>Zoom ({bg.zoom.toFixed(1)}x). Drag the panel to pan; scroll to zoom.</span>
            <input type="range" min={0.5} max={6} step={0.05} value={bg.zoom} onChange={(e) => setBg({ ...bg, zoom: +e.target.value }, false)} />
          </label>
          <div className="field">
            <span>Sky behind the world</span>
            <div className="grid-btns four">
              {(["none", "speed", "dots", "focus", "sparkle", "fade", "black", "lines"] as const).map((t) => (
                <button key={t} className="tile" aria-pressed={bg.tone === t} onClick={() => setBg({ ...bg, tone: t })}>
                  {t === "none" ? "Plain" : TONE_NAMES[t]}
                </button>
              ))}
            </div>
          </div>
          <button className="btn small" onClick={() => setBg({ ...bg, ...framed(bg.scene) })}>Reset framing</button>
        </>
      )}
    </div>
  );
}

function ItemInspector({ story, it, art, mutateItem, deleteSel, duplicateSel, reorder }: { story: Story; it: Item; art: Map<string, FriendArt> } & Pick<Props, "mutateItem" | "deleteSel" | "duplicateSel" | "reorder">) {
  const set = (patch: Partial<Item>, record = true) => mutateItem(it.id, (x) => ({ ...x, ...patch }) as Item, record);
  const title = it.t === "friend" ? `${it.friend.c} #${it.friend.id}` : it.t === "bubble" ? `${it.style} bubble` : it.t === "sfx" ? "Sound effect" : it.t === "emote" ? `Emote · ${it.kind}` : `Prop · ${it.type}`;
  return (
    <div className="panel-sec" style={{ background: "#CCFF00" }}>
      <h4>
        <span>{title.toUpperCase()}</span>
        <span className="row-btns">
          <button className="btn small" onClick={() => reorder(-1)} title="Send backward">↓</button>
          <button className="btn small" onClick={() => reorder(1)} title="Bring forward">↑</button>
          <button className="btn small" onClick={duplicateSel} title="Duplicate (Ctrl+D)">⧉</button>
          <button className="btn small danger" onClick={deleteSel} title="Delete">✕</button>
        </span>
      </h4>
      {it.t === "friend" ? (
        <>
          <div className="row-btns" style={{ alignItems: "center", marginBottom: 10 }}>
            <FriendIcon art={art.get(friendKey(it.friend))} size={56} facing={it.facing} />
            <span className="hint" style={{ margin: 0 }}>{(() => {
              const a = art.get(friendKey(it.friend));
              return a?.kind === "generations" ? `${a.family} family · FriendSDK sprite, 4 facings, idle + walk` : "Genesis portrait";
            })()}</span>
          </div>
          {art.get(friendKey(it.friend))?.kind === "generations" ? (
            <>
              <div className="field">
                <span>Facing</span>
                <div className="grid-btns four">
                  {FACINGS.map((f) => (
                    <button key={f} className="tile" aria-pressed={it.facing === f} onClick={() => set({ facing: f })}>{f}</button>
                  ))}
                </div>
              </div>
              <div className="field">
                <span>Pose</span>
                <div className="grid-btns two">
                  <button className="tile" aria-pressed={it.pose === "idle"} onClick={() => set({ pose: "idle" })}>Idle</button>
                  <button className="tile" aria-pressed={it.pose === "walk"} onClick={() => set({ pose: "walk" })}>Walking</button>
                </div>
              </div>
              <label className="field">
                <span>Frame {it.frame + 1} of 8</span>
                <input type="range" min={0} max={7} value={it.frame} onChange={(e) => set({ frame: +e.target.value }, false)} />
              </label>
            </>
          ) : null}
          <div className="row-btns" style={{ marginBottom: 10 }}>
            <button className="btn small" aria-pressed={it.flip} onClick={() => set({ flip: !it.flip })}>{it.flip ? "Unflip" : "Flip"}</button>
            <button className="btn small" onClick={() => set({ halo: !it.halo })}>{it.halo ? "Halo on" : "Halo off"}</button>
          </div>
          <div className="field">
            <span>Ink</span>
            <Swatches list={INKS} value={it.ink} onPick={(ink) => set({ ink })} color={story.color} />
          </div>
        </>
      ) : null}
      {it.t === "bubble" ? (
        <>
          <label className="field">
            <span>Words</span>
            <textarea value={it.text} maxLength={280} onChange={(e) => set({ text: e.target.value }, false)} autoFocus={!it.text} />
          </label>
          <div className="field">
            <span>Style</span>
            <div className="grid-btns">
              {BUBBLE_STYLES.map((s) => (
                <button key={s} className="tile" aria-pressed={it.style === s} onClick={() => set({ style: s })}>{s === "box" ? "Narration" : s}</button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>Letter size</span>
            <input type="range" min={12} max={72} value={it.fontSize} onChange={(e) => set({ fontSize: +e.target.value }, false)} />
          </label>
          {it.style !== "box" ? (
            <button className="btn small" onClick={() => set({ tail: it.tail ? null : { x: it.x - 40, y: it.y + 140 } })}>{it.tail ? "Remove tail" : "Add tail"}</button>
          ) : null}
          <p className="hint">Drag the green dot to point the tail at whoever is talking.</p>
        </>
      ) : null}
      {it.t === "sfx" ? (
        <>
          <label className="field">
            <span>Sound</span>
            <input type="text" value={it.text} maxLength={40} onChange={(e) => set({ text: e.target.value }, false)} />
          </label>
          <div className="field">
            <span>Lettering</span>
            <div className="grid-btns two">
              <button className="tile" aria-pressed={it.font === "bangers"} onClick={() => set({ font: "bangers" })} style={{ fontFamily: "Bangers", fontSize: 18 }}>Punchy</button>
              <button className="tile" aria-pressed={it.font === "dela"} onClick={() => set({ font: "dela" })} style={{ fontFamily: "'Dela Gothic One'", fontSize: 14 }}>Heavy</button>
            </div>
          </div>
          <div className="field">
            <span>Fill</span>
            <Swatches list={INKS} value={it.fill} onPick={(fill) => set({ fill })} color={story.color} />
          </div>
          <div className="field">
            <span>Outline</span>
            <Swatches list={INKS} value={it.stroke} onPick={(stroke) => set({ stroke })} color={story.color} />
          </div>
        </>
      ) : null}
      {it.t === "emote" ? (
        <>
          <div className="grid-btns">
            {EMOTES.map((k) => (
              <button key={k} className="tile" aria-pressed={it.kind === k} onClick={() => set({ kind: k })}>
                <svg viewBox="0 0 100 100" style={{ height: 26 }}><EmoteArt kind={k} ink="#000" /></svg>
                {k}
              </button>
            ))}
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <span>Ink</span>
            <Swatches list={INKS} value={it.ink} onPick={(ink) => set({ ink })} color={story.color} />
          </div>
        </>
      ) : null}
      {it.t !== "bubble" ? <p className="hint">Drag the green corner to resize, the round handle to rotate. Arrow keys nudge.</p> : null}
    </div>
  );
}

export function Inspector(p: Props) {
  const { story, page, sel, selItem, art, addItem, addFriend, mutatePage, mutate, pageIdx, pageActions, missing } = p;
  const [addTab, setAddTab] = useState<"friend" | "bubble" | "sfx" | "emote" | "prop">("friend");
  const [showDetails, setShowDetails] = useState(false);

  const addBubble = (style: BubbleStyle) =>
    addItem(({ x, y }) => ({ id: newId(), t: "bubble", x, y: y - 120, rot: 0, style, text: style === "box" ? "Meanwhile..." : style === "shout" ? "NO WAY!" : style === "thought" ? "hmm..." : "gm fren", w: style === "box" ? 260 : 200, fontSize: 24, tail: style === "box" ? null : { x: x - 50, y: y + 20 } }));
  const addSfx = (text: string) => addItem(({ x, y }) => ({ id: newId(), t: "sfx", x, y, rot: -8, text, size: 96, font: "bangers", fill: "#000000", stroke: "#FFFFFF" }));
  const addEmote = (kind: (typeof EMOTES)[number]) => addItem(({ x, y }) => ({ id: newId(), t: "emote", x: x + 70, y: y - 90, rot: 0, kind, size: 80, ink: "#000000" }));
  const addProp = (type: (typeof PROP_TYPES)[number]) => addItem(({ x, y, panel }) => ({ id: newId(), t: "prop", x, y: y + 80, rot: 0, panel, type, size: 260 }));

  return (
    <aside className="inspector" aria-label="Inspector">
      {selItem ? <ItemInspector story={story} it={selItem} art={art} mutateItem={p.mutateItem} deleteSel={p.deleteSel} duplicateSel={p.duplicateSel} reorder={p.reorder} /> : null}
      {sel?.k === "panel" ? <PanelInspector story={story} page={page} i={sel.i} mutatePage={mutatePage} art={art} /> : null}

      <div className="panel-sec">
        <h4>ADD TO {sel?.k === "panel" ? `PANEL ${sel.i + 1}` : "PAGE"}</h4>
        <div className="grid-btns" style={{ gridTemplateColumns: "repeat(5, 1fr)", marginBottom: 12 }}>
          {(["friend", "bubble", "sfx", "emote", "prop"] as const).map((t) => (
            <button key={t} className="tile" aria-pressed={addTab === t} onClick={() => setAddTab(t)}>{t === "sfx" ? "SFX" : t[0].toUpperCase() + t.slice(1)}</button>
          ))}
        </div>
        {addTab === "friend" ? <FriendPicker onPick={addFriend} /> : null}
        {addTab === "bubble" ? (
          <div className="grid-btns">
            {BUBBLE_STYLES.map((s) => (
              <button key={s} className="tile" onClick={() => addBubble(s)}>{s === "box" ? "Narration" : s}</button>
            ))}
          </div>
        ) : null}
        {addTab === "sfx" ? (
          <div className="grid-btns">
            {SFX_PRESETS.map((t) => (
              <button key={t} className="tile" onClick={() => addSfx(t)} style={{ fontFamily: "Bangers", fontSize: 16, letterSpacing: "0.03em" }}>{t}</button>
            ))}
          </div>
        ) : null}
        {addTab === "emote" ? (
          <div className="grid-btns">
            {EMOTES.map((k) => (
              <button key={k} className="tile" onClick={() => addEmote(k)}>
                <svg viewBox="0 0 100 100" style={{ height: 26 }}><EmoteArt kind={k} ink="#000" /></svg>
                {k}
              </button>
            ))}
          </div>
        ) : null}
        {addTab === "prop" ? (
          <div className="grid-btns four">
            {PROP_TYPES.map((t) => (
              <button key={t} className="tile" onClick={() => addProp(t)} aria-label={`Add ${t}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={propImage(t, story.color)} alt="" style={{ height: 40, transform: "scale(1.6) translateY(-3px)" }} />
                {t}
              </button>
            ))}
          </div>
        ) : null}
        {missing.length ? <p className="hint">Could not load art for {missing.join(", ")}. Those show as a dashed box.</p> : null}
      </div>

      <div className="panel-sec">
        <h4>
          <span>PAGE {pageIdx + 1} OF {story.pages.length}</span>
          <span className="row-btns">
            <button className="btn small" onClick={() => pageActions.movePage(-1)} disabled={pageIdx === 0} title="Move page up">↑</button>
            <button className="btn small" onClick={() => pageActions.movePage(1)} disabled={pageIdx === story.pages.length - 1} title="Move page down">↓</button>
          </span>
        </h4>
        <div className="grid-btns">
          {LAYOUT_IDS.map((id) => (
            <button key={id} className="tile" aria-pressed={page.layout === id} onClick={() => mutatePage((pg) => relayout(pg, id))}>
              <LayoutIcon id={id} />
              {LAYOUTS[id].name}
            </button>
          ))}
        </div>
        <div className="row-btns" style={{ marginTop: 10 }}>
          <div className="toggle" role="group" aria-label="Gutters">
            <button aria-pressed={page.gutter === "white"} onClick={() => mutatePage((pg) => ({ ...pg, gutter: "white" }))}>White gutters</button>
            <button aria-pressed={page.gutter === "black"} onClick={() => mutatePage((pg) => ({ ...pg, gutter: "black" }))}>Black</button>
          </div>
        </div>
        <div className="row-btns" style={{ marginTop: 10 }}>
          <button className="btn small" onClick={pageActions.addPage}>+ New page</button>
          <button className="btn small" onClick={pageActions.dupPage}>Duplicate</button>
          <button className="btn small danger" onClick={pageActions.delPage} disabled={story.pages.length <= 1}>Delete page</button>
        </div>
        <p className="hint">Click a panel to set its background: a screentone, or a world from FriendSDK or your own.</p>
      </div>

      <div className="panel-sec">
        <h4>
          <span>ISSUE DETAILS</span>
          <button className="btn small" onClick={() => setShowDetails((v) => !v)}>{showDetails ? "Hide" : "Edit"}</button>
        </h4>
        {showDetails ? (
          <>
            <label className="field">
              <span>Logline (shows on the reader page and the shelf)</span>
              <textarea value={story.logline} maxLength={240} onChange={(e) => mutate((s) => ({ ...s, logline: e.target.value }), false)} style={{ fontFamily: "var(--f-ui)", fontSize: 14 }} />
            </label>
            <label className="field">
              <span>Pen name (optional, otherwise your wallet)</span>
              <input type="text" value={story.penName} maxLength={40} onChange={(e) => mutate((s) => ({ ...s, penName: e.target.value }), false)} />
            </label>
          </>
        ) : (
          <p className="hint" style={{ marginTop: 0 }}>{story.logline || "Add a logline and a pen name before you publish."}</p>
        )}
        {story.remixOf ? <p className="hint">Remix of “{story.remixOf.title}” by {story.remixOf.by}. The credit stays on the published issue.</p> : null}
      </div>
    </aside>
  );
}
