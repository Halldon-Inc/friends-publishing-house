"use client";
import { getWorldPreset, project, renderProp, renderWorld, validateWorld, worldContains, PROP_CANVAS } from "@rarefriends/friendsdk/world";
import { artRows, type FriendArt } from "@/lib/art";
import { friendKey, type PropType, type WorldScene } from "@/lib/model";

/**
 * FriendSDK does the world drawing: the creator's scene becomes an SDK WorldConfig (the base preset's terrain with
 * the creator's props), and its Friends are passed as SDK actors so the renderer depth-sorts them among the props.
 * Results are data URIs, which is what lets a page with a world in it export to PNG in the browser.
 */
const cache = new Map<string, string>();
const CACHE_MAX = 80;
const remember = (key: string, value: string) => {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, value);
  return value;
};
const svgUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export function worldImage(scene: WorldScene, color: boolean, art: Map<string, FriendArt>): string {
  const castKey = scene.cast.map((a) => `${friendKey(a.friend)}:${art.has(friendKey(a.friend)) ? 1 : 0}`).join(",");
  const key = `${color ? "c" : "m"}|${JSON.stringify(scene)}|${castKey}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let svg: string;
  try {
    const base = getWorldPreset(scene.base);
    const preset = structuredClone(base) as unknown as Record<string, unknown>;
    const config = validateWorld({
      ...preset,
      id: `fph-${scene.base}`,
      // The SDK refuses a world with a prop off its ground, so a stray prop is dropped rather than failing the world.
      props: scene.props.filter((p) => onGround(scene.base, p.x, p.y)).map((p) => ({ type: p.type, x: Math.round(p.x), y: Math.round(p.y), scale: Math.round(p.scale * 100) / 100 })),
      // The anchors are the preset's canonical composition only; the scene's cast is supplied as live actors below.
      actors: [],
      signals: [],
    });
    const actors = scene.cast.flatMap((a) => {
      const f = art.get(friendKey(a.friend));
      // Same rule as props: a Friend off the ground is left out instead of failing the whole world.
      if (!f || !onGround(scene.base, a.x, a.y)) return [];
      return [{ x: a.x, y: a.y, rows: spriteBox(artRows(f, a.facing, a.pose, a.frame)), pixelScale: a.scale }];
    });
    svg = renderWorld(config, { color, actors, signals: false });
  } catch {
    svg = renderWorld(getWorldPreset(scene.base), { color, signals: false });
  }
  return remember(key, svgUri(svg));
}

/**
 * Framing that fits a base world's terrain (plus headroom for props) inside a panel box: the values a world
 * background's `zoom`, `cx` and `cy` should take so the whole island reads, centred.
 */
export function fitWorld(base: WorldScene["base"], box: { w: number; h: number }, fill = 0.94) {
  const pts = getWorldPreset(base).geometry.polygons.flat().map(([x, y]) => project(x, y));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys) - 120;
  const y1 = Math.max(...ys) + 30;
  const want = Math.min((box.w * fill) / (x1 - x0), (box.h * fill) / (y1 - y0));
  const cover = Math.max(box.w / 1600, box.h / 1200);
  return { zoom: Math.max(0.5, Math.min(6, want / cover)), cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/** Whether a ground point is on the base world's loaded terrain (the SDK's own test). */
export const onGround = (base: WorldScene["base"], x: number, y: number) => worldContains(getWorldPreset(base), [x, y]);

/**
 * The SDK places an actor as a 16 x 16 sprite anchored at its bottom-centre (row 15). A Genesis portrait is 8 x 8,
 * so it is centred horizontally and stood on row 14 to match the Generations sprites' feet.
 */
function spriteBox(rows: string[]): string[] {
  if (rows.length === 16 && rows[0]?.length === 16) return rows;
  const w = rows[0]?.length ?? 0;
  const padL = Math.max(0, Math.floor((16 - w) / 2));
  const body = rows.map((r) => ".".repeat(padL) + r + ".".repeat(Math.max(0, 16 - padL - w)));
  const top = Math.max(0, 15 - body.length);
  return [...Array.from({ length: top }, () => ".".repeat(16)), ...body, ...Array.from({ length: Math.max(0, 16 - top - body.length) }, () => ".".repeat(16))].slice(0, 16);
}

export function propImage(type: PropType, color: boolean): string {
  const key = `prop|${type}|${color}`;
  return cache.get(key) ?? remember(key, svgUri(renderProp(type, { color })));
}
export const PROP_BOX = PROP_CANVAS;
