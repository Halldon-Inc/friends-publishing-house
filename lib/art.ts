import type { Facing, Pose } from "./model";

/**
 * A Friend's artwork as one-bit pixel rows ("#" = ink, "." = paper). Genesis Friends are 8 x 8 on-chain portraits;
 * Generations Friends are FriendSDK's canonical 16 x 16 sprites with idle and walk clips in four facings.
 */
export type FriendArt =
  | { kind: "genesis"; id: string; rows: string[] }
  | { kind: "generations"; id: string; family: string; clips: Record<string, string[][]> };

export const clipKey = (pose: Pose, facing: Facing) => `${pose}-${facing}`;

export function artRows(art: FriendArt, facing: Facing, pose: Pose, frame: number): string[] {
  if (art.kind === "genesis") return art.rows;
  const clip = art.clips[clipKey(pose, facing)] ?? art.clips[clipKey("idle", "down")] ?? Object.values(art.clips)[0] ?? [];
  return clip[frame % Math.max(1, clip.length)] ?? clip[0] ?? [];
}

/** One SVG path for the ink pixels, each row's runs merged into single rectangles. Coordinates are in pixels. */
export function rowsToPath(rows: string[], ink = "#"): string {
  let d = "";
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== ink) {
        x++;
        continue;
      }
      const start = x;
      while (x < row.length && row[x] === ink) x++;
      d += `M${start} ${y}h${x - start}v1h${start - x}z`;
    }
  });
  return d;
}

/** Pixels next to ink that are not ink: the one-pixel halo the SDK's reference renderer draws in white. */
export function haloRows(rows: string[]): string[] {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const at = (x: number, y: number) => y >= 0 && y < h && x >= 0 && x < w && rows[y][x] === "#";
  return rows.map((row, y) =>
    Array.from(row, (c, x) => (c !== "#" && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) ? "#" : ".")).join(""),
  );
}

export function isArt(v: unknown): v is FriendArt {
  if (typeof v !== "object" || v === null) return false;
  const a = v as Record<string, unknown>;
  const rowsOk = (r: unknown) => Array.isArray(r) && r.length > 0 && r.length <= 32 && r.every((s) => typeof s === "string" && /^[#.]{1,32}$/.test(s));
  if (a.kind === "genesis") return rowsOk(a.rows);
  if (a.kind === "generations" && typeof a.clips === "object" && a.clips !== null) return Object.values(a.clips as object).every((c) => Array.isArray(c) && c.every(rowsOk));
  return false;
}
