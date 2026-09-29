import { LAYOUTS, panelPoints, type Item, type LayoutId } from "@/lib/model";

export function pointInPoly(x: number, y: number, pts: [number, number][]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The panel under a page point, or the nearest panel centre when the point is in a gutter. */
export function panelAt(layout: LayoutId, x: number, y: number): number {
  const n = LAYOUTS[layout].panels.length;
  for (let i = 0; i < n; i++) if (pointInPoly(x, y, panelPoints(layout, i))) return i;
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < n; i++) {
    const pts = panelPoints(layout, i);
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const d = Math.hypot(cx - x, cy - y);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

/** The size-like property a corner drag scales, per item type. */
export function sizeOf(it: Item): number {
  switch (it.t) {
    case "bubble":
      return it.w;
    default:
      return it.size;
  }
}
export function withSize(it: Item, v: number): Item {
  switch (it.t) {
    case "bubble":
      return { ...it, w: Math.max(80, Math.min(700, v)) };
    case "friend":
      return { ...it, size: Math.max(24, Math.min(1200, v)) };
    case "sfx":
      return { ...it, size: Math.max(16, Math.min(360, v)) };
    case "emote":
      return { ...it, size: Math.max(16, Math.min(400, v)) };
    case "prop":
      return { ...it, size: Math.max(40, Math.min(900, v)) };
  }
}
