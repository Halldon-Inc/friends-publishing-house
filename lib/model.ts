/**
 * The document model shared by the studio (browser) and the API (server). Everything a reader sees is drawn from
 * these plain JSON shapes, and every shape that crosses the network goes through `parseStory` / `parseWorld`, which
 * rebuild the object field by field (unknown keys are dropped, numbers are clamped, text is capped).
 */

export const PAGE_W = 800;
export const PAGE_H = 1200;
export const MAX_PAGES = 24;
export const MAX_ITEMS_PER_PAGE = 60;
export const MAX_WORLD_PROPS = 40;
export const MAX_WORLD_CAST = 8;

export type Collection = "Genesis" | "Generations";
export type FriendRef = { c: Collection; id: string };
export const friendKey = (f: FriendRef) => `${f.c}:${f.id}`;

export const FACINGS = ["down", "up", "left", "right"] as const;
export type Facing = (typeof FACINGS)[number];
export const POSES = ["idle", "walk"] as const;
export type Pose = (typeof POSES)[number];

/** FriendSDK prop types (kept in sync with `PROP_TYPES` in @rarefriends/friendsdk/world). */
export const PROP_TYPES = ["tree", "flower", "bench", "planter", "terminal", "crate", "pipe", "tank", "crystal", "rock", "vent", "antenna", "solar", "dish", "buoy", "reeds", "bridge", "circuit"] as const;
export type PropType = (typeof PROP_TYPES)[number];

/** The complete FriendSDK world presets a world can be built on. */
export const WORLD_BASES = [
  { id: "01-garden-oval-complete", name: "Garden Commons" },
  { id: "02-circuit-courtyard-complete", name: "Circuit Courtyard" },
  { id: "03-crystal-mesa-complete", name: "Crystal Steps" },
  { id: "04-rooftop-terrace-complete", name: "Rooftop Hangout" },
  { id: "05-tidal-islands-complete", name: "Tidal Islands" },
  { id: "06-orbital-hex-complete", name: "Orbital Array" },
] as const;
export type WorldBaseId = (typeof WORLD_BASES)[number]["id"];

export type WorldProp = { type: PropType; x: number; y: number; scale: number };
export type WorldCast = { friend: FriendRef; x: number; y: number; facing: Facing; pose: Pose; frame: number; scale: number };
/** A world as drawn: an SDK base terrain plus the creator's props and cast. Snapshotted into panels that use it. */
export type WorldScene = { base: WorldBaseId; props: WorldProp[]; cast: WorldCast[] };
export type WorldDoc = { id: string; owner: string; name: string; color: boolean; scene: WorldScene; createdAt: number; updatedAt: number };

export const TONES = ["white", "black", "dots", "dense", "lines", "cross", "speed", "focus", "sparkle", "fade"] as const;
export type Tone = (typeof TONES)[number];

/** Paper colours for colour mode. The first two also exist in mono. The rest are FriendSDK's GAME_PALETTE plus signal green. */
export const PAPERS = ["#FFFFFF", "#000000", "#B9D984", "#7DB4DB", "#F2CE68", "#ED927E", "#B3A0D8", "#CCFF00"] as const;
export const INKS = ["#000000", "#FFFFFF", "#E8413C", "#2F5BD3", "#CCFF00", "#B3A0D8"] as const;

export type PanelBg =
  | { kind: "tone"; tone: Tone; paper: string; focusX: number; focusY: number }
  | { kind: "world"; scene: WorldScene; worldName: string; zoom: number; cx: number; cy: number; tone: Tone | "none" };
export type Panel = { bg: PanelBg };

export type BubbleStyle = "speech" | "shout" | "thought" | "whisper" | "box";
export const BUBBLE_STYLES: BubbleStyle[] = ["speech", "shout", "thought", "whisper", "box"];
export const EMOTES = ["sweat", "anger", "heart", "shock", "question", "dots", "zzz", "sparkles", "note", "tear"] as const;
export type Emote = (typeof EMOTES)[number];
export const SFX_FONTS = ["bangers", "dela"] as const;

type Base = { id: string; x: number; y: number; rot: number };
export type Item =
  | (Base & { t: "friend"; panel: number; friend: FriendRef; size: number; facing: Facing; pose: Pose; frame: number; flip: boolean; ink: string; halo: boolean })
  | (Base & { t: "bubble"; style: BubbleStyle; text: string; w: number; fontSize: number; tail: { x: number; y: number } | null })
  | (Base & { t: "sfx"; text: string; size: number; font: (typeof SFX_FONTS)[number]; fill: string; stroke: string })
  | (Base & { t: "emote"; kind: Emote; size: number; ink: string })
  | (Base & { t: "prop"; panel: number; type: PropType; size: number });
export type ItemType = Item["t"];

export type Page = { layout: LayoutId; gutter: "white" | "black"; panels: Panel[]; items: Item[] };
export type RemixOf = { slug: string; title: string; by: string };
export type Story = {
  id: string;
  owner: string;
  title: string;
  logline: string;
  penName: string;
  color: boolean;
  pages: Page[];
  remixOf: RemixOf | null;
  createdAt: number;
  updatedAt: number;
  published: { slug: string; version: number; at: number } | null;
};

// ===== layouts =====
// Panels are polygons on the 800 x 1200 page. Slanted cuts are what make a page read as manga rather than a grid.
type Pt = [number, number];
const M = 28; // page margin
const G = 16; // gutter
const R = PAGE_W - M;
const B = PAGE_H - M;
const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const midX = PAGE_W / 2;

export const LAYOUTS = {
  splash: { name: "Splash", panels: [rect(M, M, R, B)] },
  two: { name: "Two tiers", panels: [rect(M, M, R, 600 - G / 2), rect(M, 600 + G / 2, R, B)] },
  three: { name: "Wide + two", panels: [rect(M, M, R, 560), rect(M, 560 + G, midX - G / 2, B), rect(midX + G / 2, 560 + G, R, B)] },
  four: { name: "Grid", panels: [rect(M, M, midX - G / 2, 600 - G / 2), rect(midX + G / 2, M, R, 600 - G / 2), rect(M, 600 + G / 2, midX - G / 2, B), rect(midX + G / 2, 600 + G / 2, R, B)] },
  slash: {
    name: "Slash",
    panels: [
      [[M, M], [R, M], [R, 380], [M, 460]] as Pt[],
      [[M, 460 + G], [R, 380 + G], [R, 760], [M, 840]] as Pt[],
      [[M, 840 + G], [R, 760 + G], [R, B], [M, B]] as Pt[],
    ],
  },
  impact: {
    name: "Impact",
    panels: [
      [[M, M], [R, M], [R, 700], [M, 820]] as Pt[],
      [[M, 820 + G], [480, 780 + G], [440, B], [M, B]] as Pt[],
      [[480 + G, 780 + G - 4], [R, 700 + G], [R, B], [440 + G, B]] as Pt[],
    ],
  },
  yonkoma: {
    name: "4-koma",
    panels: [0, 1, 2, 3].map((i) => {
      const h = (B - M - G * 3) / 4;
      const y0 = M + i * (h + G);
      return rect(M + 110, y0, R - 110, y0 + h);
    }),
  },
  cinema: { name: "Cinema", panels: [rect(M, M, R, 340), rect(M, 340 + G, R, 780), rect(M, 780 + G, R, B)] },
  shards: {
    name: "Shards",
    panels: [
      [[M, M], [520, M], [420, 520], [M, 600]] as Pt[],
      [[520 + G, M], [R, M], [R, 470], [420 + G + 8, 520 - 4]] as Pt[],
      [[M, 600 + G], [420 + G / 2, 520 + G + 4], [R, 470 + G], [R, B], [M, B]] as Pt[],
    ],
  },
} satisfies Record<string, { name: string; panels: Pt[][] }>;
export type LayoutId = keyof typeof LAYOUTS;
export const LAYOUT_IDS = Object.keys(LAYOUTS) as LayoutId[];

export const panelPoints = (layout: LayoutId, i: number): Pt[] => LAYOUTS[layout].panels[i] ?? LAYOUTS[layout].panels[0];
export function panelBox(layout: LayoutId, i: number) {
  const pts = panelPoints(layout, i);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// ===== factories =====
export const newId = () => {
  const b = new Uint8Array(9);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(36).padStart(2, "0")).join("").slice(0, 14);
};
export const toneBg = (tone: Tone = "white", paper = "#FFFFFF"): PanelBg => ({ kind: "tone", tone, paper, focusX: 0.5, focusY: 0.5 });
export const defaultScene = (base: WorldBaseId = "01-garden-oval-complete"): WorldScene => ({ base, props: [], cast: [] });
export const worldBg = (scene: WorldScene, worldName: string): Extract<PanelBg, { kind: "world" }> => ({ kind: "world", scene, worldName, zoom: 1.1, cx: 800, cy: 640, tone: "none" });

export function newPage(layout: LayoutId = "three"): Page {
  const tones: Tone[] = ["white", "speed", "dots", "focus"];
  return { layout, gutter: "white", panels: LAYOUTS[layout].panels.map((_, i) => ({ bg: toneBg(tones[i % tones.length]) })), items: [] };
}

/** Changing layout keeps existing panel backgrounds by index and clamps items to the new panel count. */
export function relayout(page: Page, layout: LayoutId): Page {
  const n = LAYOUTS[layout].panels.length;
  const panels = Array.from({ length: n }, (_, i) => page.panels[i] ?? { bg: toneBg() });
  const items = page.items.map((it) => ("panel" in it ? { ...it, panel: Math.min(it.panel, n - 1) } : it));
  return { ...page, layout, panels, items };
}

export function newStory(owner: string): Story {
  const now = Date.now();
  const first = newPage("splash");
  first.panels[0].bg = worldBg(defaultScene(), "Garden Commons");
  first.items.push(
    { id: newId(), t: "sfx", x: 400, y: 150, rot: -4, text: "CHAPTER 1", size: 92, font: "dela", fill: "#000000", stroke: "#FFFFFF" },
    { id: newId(), t: "bubble", x: 520, y: 900, rot: 0, style: "box", text: "Every Friend has a story. This one starts here.", w: 300, fontSize: 24, tail: null },
  );
  return { id: newId(), owner, title: "Untitled Manga", logline: "", penName: "", color: false, pages: [first, newPage("three")], remixOf: null, createdAt: now, updatedAt: now, published: null };
}

export function newWorld(owner: string, base: WorldBaseId = "01-garden-oval-complete"): WorldDoc {
  const now = Date.now();
  return { id: newId(), owner, name: "Untitled World", color: true, scene: defaultScene(base), createdAt: now, updatedAt: now };
}

// ===== validation =====
type J = Record<string, unknown>;
const isObj = (v: unknown): v is J => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const int = (v: unknown, lo: number, hi: number, d: number) => Math.round(num(v, lo, hi, d));
const str = (v: unknown, max: number, d = "") => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, max) : d);
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);
const bool = (v: unknown, d = false) => (typeof v === "boolean" ? v : d);
const hex = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : d);
const idStr = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{6,24}$/.test(v) ? v : newId());
export const isAddress = (v: unknown): v is string => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);

export function parseFriend(v: unknown): FriendRef | null {
  if (!isObj(v)) return null;
  const c = v.c === "Genesis" || v.c === "Generations" ? v.c : null;
  const id = typeof v.id === "string" && /^[1-9][0-9]{0,9}$/.test(v.id) ? v.id : null;
  return c && id ? { c, id } : null;
}

export function parseScene(v: unknown): WorldScene {
  const o = isObj(v) ? v : {};
  const base = oneOf(o.base, WORLD_BASES.map((b) => b.id), "01-garden-oval-complete");
  const props = (Array.isArray(o.props) ? o.props : []).slice(0, MAX_WORLD_PROPS).flatMap((p): WorldProp[] => {
    if (!isObj(p) || !PROP_TYPES.includes(p.type as PropType)) return [];
    return [{ type: p.type as PropType, x: num(p.x, -40, 616, 288), y: num(p.y, -40, 424, 192), scale: num(p.scale, 0.4, 2.5, 1) }];
  });
  const cast = (Array.isArray(o.cast) ? o.cast : []).slice(0, MAX_WORLD_CAST).flatMap((a): WorldCast[] => {
    const friend = isObj(a) ? parseFriend(a.friend) : null;
    if (!isObj(a) || !friend) return [];
    return [{ friend, x: num(a.x, -40, 616, 288), y: num(a.y, -40, 424, 192), facing: oneOf(a.facing, FACINGS, "down"), pose: oneOf(a.pose, POSES, "idle"), frame: int(a.frame, 0, 7, 0), scale: int(a.scale, 2, 8, 4) }];
  });
  return { base, props, cast };
}

function parseBg(v: unknown): PanelBg {
  const o = isObj(v) ? v : {};
  if (o.kind === "world") {
    return { kind: "world", scene: parseScene(o.scene), worldName: str(o.worldName, 60, "World"), zoom: num(o.zoom, 0.5, 6, 1.4), cx: num(o.cx, 0, 1600, 800), cy: num(o.cy, 0, 1200, 620), tone: o.tone === "none" ? "none" : oneOf(o.tone, TONES, "white") };
  }
  return { kind: "tone", tone: oneOf(o.tone, TONES, "white"), paper: hex(o.paper, "#FFFFFF"), focusX: num(o.focusX, 0, 1, 0.5), focusY: num(o.focusY, 0, 1, 0.5) };
}

function parseItem(v: unknown, panels: number): Item | null {
  if (!isObj(v)) return null;
  const base = { id: idStr(v.id), x: num(v.x, -200, PAGE_W + 200, PAGE_W / 2), y: num(v.y, -200, PAGE_H + 200, PAGE_H / 2), rot: num(v.rot, -180, 180, 0) };
  const panel = int(v.panel, 0, Math.max(0, panels - 1), 0);
  switch (v.t) {
    case "friend": {
      const friend = parseFriend(v.friend);
      if (!friend) return null;
      return { ...base, t: "friend", panel, friend, size: num(v.size, 24, 1200, 220), facing: oneOf(v.facing, FACINGS, "down"), pose: oneOf(v.pose, POSES, "idle"), frame: int(v.frame, 0, 7, 0), flip: bool(v.flip), ink: hex(v.ink, "#000000"), halo: bool(v.halo, true) };
    }
    case "bubble":
      return { ...base, t: "bubble", style: oneOf(v.style, BUBBLE_STYLES, "speech"), text: str(v.text, 280), w: num(v.w, 80, 700, 240), fontSize: num(v.fontSize, 12, 72, 24), tail: isObj(v.tail) ? { x: num(v.tail.x, -200, PAGE_W + 200, base.x), y: num(v.tail.y, -200, PAGE_H + 200, base.y + 120) } : null };
    case "sfx":
      return { ...base, t: "sfx", text: str(v.text, 40, "BAM"), size: num(v.size, 16, 360, 96), font: oneOf(v.font, SFX_FONTS, "bangers"), fill: hex(v.fill, "#000000"), stroke: hex(v.stroke, "#FFFFFF") };
    case "emote":
      return { ...base, t: "emote", kind: oneOf(v.kind, EMOTES, "sweat"), size: num(v.size, 16, 400, 80), ink: hex(v.ink, "#000000") };
    case "prop":
      if (!PROP_TYPES.includes(v.type as PropType)) return null;
      return { ...base, t: "prop", panel, type: v.type as PropType, size: num(v.size, 40, 900, 240) };
    default:
      return null;
  }
}

function parsePage(v: unknown): Page {
  const o = isObj(v) ? v : {};
  const layout = oneOf(o.layout, LAYOUT_IDS, "three");
  const n = LAYOUTS[layout].panels.length;
  const rawPanels = Array.isArray(o.panels) ? o.panels : [];
  const panels = Array.from({ length: n }, (_, i) => ({ bg: parseBg(isObj(rawPanels[i]) ? (rawPanels[i] as J).bg : undefined) }));
  const items = (Array.isArray(o.items) ? o.items : []).slice(0, MAX_ITEMS_PER_PAGE).map((it) => parseItem(it, n)).filter((x): x is Item => x !== null);
  return { layout, gutter: o.gutter === "black" ? "black" : "white", panels, items };
}

/** Rebuilds a story from untrusted JSON. `owner`, `id` and publishing fields are the server's to set, never the client's. */
export function parseStory(v: unknown, trusted: Pick<Story, "id" | "owner" | "createdAt" | "published" | "remixOf">): Story {
  const o = isObj(v) ? v : {};
  const pages = (Array.isArray(o.pages) ? o.pages : []).slice(0, MAX_PAGES).map(parsePage);
  return {
    ...trusted,
    title: str(o.title, 80, "Untitled Manga").trim() || "Untitled Manga",
    logline: str(o.logline, 240).trim(),
    penName: str(o.penName, 40).trim(),
    color: bool(o.color),
    pages: pages.length ? pages : [newPage()],
    updatedAt: Date.now(),
  };
}

export function parseWorld(v: unknown, trusted: Pick<WorldDoc, "id" | "owner" | "createdAt">): WorldDoc {
  const o = isObj(v) ? v : {};
  return { ...trusted, name: str(o.name, 60, "Untitled World").trim() || "Untitled World", color: bool(o.color, true), scene: parseScene(o.scene), updatedAt: Date.now() };
}

export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
export const byline = (s: { penName: string; owner: string }) => s.penName || shortAddr(s.owner);

/** Every Friend a story needs artwork for, deduplicated. */
export function storyCast(pages: Page[]): FriendRef[] {
  const out = new Map<string, FriendRef>();
  for (const p of pages) {
    for (const it of p.items) if (it.t === "friend") out.set(friendKey(it.friend), it.friend);
    for (const pn of p.panels) if (pn.bg.kind === "world") for (const a of pn.bg.scene.cast) out.set(friendKey(a.friend), a.friend);
  }
  return [...out.values()];
}
