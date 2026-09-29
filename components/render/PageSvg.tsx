"use client";
import { memo, useMemo, type ReactNode, type Ref } from "react";
import { artRows, haloRows, rowsToPath, type FriendArt } from "@/lib/art";
import { friendKey, PAGE_H, PAGE_W, panelBox, panelPoints, type Emote, type Item, type Page, type PanelBg, type Tone } from "@/lib/model";
import { FONTS, LETTER_WEIGHT, wrap } from "./text";
import { propImage, PROP_BOX, worldImage } from "./worlds";

/**
 * Draws one manga page as SVG. The studio shows it live and the publisher rasterises the very same element, so a
 * page reads identically in the editor, in the reader and on X.
 */
export type PageSvgProps = {
  page: Page;
  color: boolean;
  art: Map<string, FriendArt>;
  uid: string;
  className?: string;
  svgRef?: Ref<SVGSVGElement>;
  /** Editor overlay (selection handles), drawn last. Never part of an export. */
  children?: ReactNode;
  title?: string;
};

type Box = { x: number; y: number; w: number; h: number };

// ===== colour =====
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};
/** In black-and-white mode every colour collapses to paper or ink. */
export const tint = (hex: string, color: boolean) => (color ? hex : lum(hex) > 0.5 ? "#FFFFFF" : "#000000");

// ===== deterministic noise, so a tone looks the same every render =====
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Tones({ uid }: { uid: string }) {
  const dot = (id: string, r: number, gap: number) => (
    <pattern id={`${uid}-${id}`} width={gap} height={gap} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <circle cx={gap / 2} cy={gap / 2} r={r} fill="#000" />
    </pattern>
  );
  return (
    <>
      {dot("dots", 1.9, 9)}
      {dot("dense", 3.1, 8)}
      {Array.from({ length: 10 }, (_, i) => <g key={i}>{dot(`fade${i}`, 0.35 + i * 0.42, 9)}</g>)}
      <pattern id={`${uid}-lines`} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
        <rect width="10" height="2.4" fill="#000" />
      </pattern>
      <pattern id={`${uid}-cross`} width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
        <rect width="11" height="1.8" fill="#000" />
        <rect width="1.8" height="11" fill="#000" />
      </pattern>
    </>
  );
}

function ToneLayer({ tone, box, paper, uid, seed, fx, fy, color }: { tone: Tone; box: Box; paper: string; uid: string; seed: number; fx: number; fy: number; color: boolean }) {
  const bg = tone === "black" ? "#000000" : tint(paper, color);
  const fill = <rect x={box.x - 2} y={box.y - 2} width={box.w + 4} height={box.h + 4} fill={bg} />;
  const r = rng(seed);
  switch (tone) {
    case "dots":
    case "dense":
    case "lines":
    case "cross":
      return (
        <>
          {fill}
          <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={`url(#${uid}-${tone})`} opacity={tone === "dense" ? 0.9 : 1} />
        </>
      );
    case "fade": {
      const band = box.h / 10;
      return (
        <>
          {fill}
          {Array.from({ length: 10 }, (_, i) => (
            <rect key={i} x={box.x} y={box.y + i * band} width={box.w} height={band + 0.5} fill={`url(#${uid}-fade${i})`} />
          ))}
        </>
      );
    }
    case "speed": {
      const n = Math.round(box.h / 7);
      const lines = Array.from({ length: n }, () => {
        const y = box.y + r() * box.h;
        const len = box.w * (0.25 + r() * 0.75);
        const fromRight = r() > 0.5;
        const x0 = fromRight ? box.x + box.w - len : box.x;
        return { y, x0, len, t: 0.8 + r() * 3.4 };
      });
      return (
        <>
          {fill}
          {lines.map((l, i) => (
            <path key={i} d={`M${l.x0} ${l.y}h${l.len}`} stroke="#000" strokeWidth={l.t} strokeLinecap="round" />
          ))}
        </>
      );
    }
    case "focus": {
      const cx = box.x + box.w * fx;
      const cy = box.y + box.h * fy;
      const R = Math.hypot(box.w, box.h);
      const n = 150;
      const wedges = Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + r() * 0.03;
        const da = 0.006 + r() * 0.012;
        const inner = Math.min(box.w, box.h) * (0.26 + r() * 0.24);
        const p = (ang: number, rad: number) => `${(cx + Math.cos(ang) * rad).toFixed(1)} ${(cy + Math.sin(ang) * rad).toFixed(1)}`;
        return `M${p(a - da, R)}L${p(a, inner)}L${p(a + da, R)}Z`;
      });
      return (
        <>
          {fill}
          <path d={wedges.join("")} fill="#000" />
        </>
      );
    }
    case "sparkle": {
      const n = Math.round((box.w * box.h) / 16000);
      const bits = Array.from({ length: n }, () => ({ x: box.x + r() * box.w, y: box.y + r() * box.h, s: 4 + r() * 16, star: r() > 0.45 }));
      return (
        <>
          {fill}
          {bits.map((b, i) =>
            b.star ? (
              <path key={i} d={`M${b.x} ${b.y - b.s}Q${b.x} ${b.y} ${b.x + b.s} ${b.y}Q${b.x} ${b.y} ${b.x} ${b.y + b.s}Q${b.x} ${b.y} ${b.x - b.s} ${b.y}Q${b.x} ${b.y} ${b.x} ${b.y - b.s}Z`} fill="#000" />
            ) : (
              <circle key={i} cx={b.x} cy={b.y} r={b.s} fill="none" stroke="#000" strokeWidth={1.4} />
            ),
          )}
        </>
      );
    }
    default:
      return fill;
  }
}

function PanelBackground({ bg, box, uid, seed, color, art }: { bg: PanelBg; box: Box; uid: string; seed: number; color: boolean; art: Map<string, FriendArt> }) {
  if (bg.kind === "tone") return <ToneLayer tone={bg.tone} box={box} paper={bg.paper} uid={uid} seed={seed} fx={bg.focusX} fy={bg.focusY} color={color} />;
  const s = Math.max(box.w / 1600, box.h / 1200) * bg.zoom;
  const tx = box.x + box.w / 2 - bg.cx * s;
  const ty = box.y + box.h / 2 - bg.cy * s;
  return (
    <>
      {bg.tone === "none" ? <rect x={box.x - 2} y={box.y - 2} width={box.w + 4} height={box.h + 4} fill="#FFFFFF" /> : <ToneLayer tone={bg.tone} box={box} paper="#FFFFFF" uid={uid} seed={seed} fx={0.5} fy={0.5} color={color} />}
      <image href={worldImage(bg.scene, color, art)} x={0} y={0} width={1600} height={1200} transform={`translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})`} preserveAspectRatio="none" />
    </>
  );
}

// ===== items =====
function FriendSprite({ it, art, color }: { it: Extract<Item, { t: "friend" }>; art: FriendArt | undefined; color: boolean }) {
  if (!art) {
    return (
      <g transform={`translate(${it.x} ${it.y}) rotate(${it.rot})`}>
        <rect x={-it.size / 2} y={-it.size / 2} width={it.size} height={it.size} fill="#fff" stroke="#000" strokeWidth={3} strokeDasharray="10 8" />
        <text textAnchor="middle" dy="0.35em" fontFamily={FONTS.dela} fontSize={it.size * 0.3}>?</text>
      </g>
    );
  }
  const rows = artRows(art, it.facing, it.pose, it.frame);
  const w = rows[0]?.length ?? 8;
  const h = rows.length || 8;
  const s = it.size / w;
  const ink = tint(it.ink, color);
  const halo = lum(ink) > 0.5 ? "#000000" : "#FFFFFF";
  return (
    <g transform={`translate(${it.x} ${it.y}) rotate(${it.rot}) scale(${it.flip ? -s : s} ${s}) translate(${-w / 2} ${-h / 2})`} shapeRendering="crispEdges">
      {it.halo && <path d={rowsToPath(haloRows(rows))} fill={halo} />}
      <path d={rowsToPath(rows)} fill={ink} />
    </g>
  );
}

export function bubbleLayout(it: Extract<Item, { t: "bubble" }>) {
  const pad = it.style === "box" ? 14 : 8;
  const lines = wrap(it.text || " ", it.fontSize, it.w - pad * 2);
  const lineH = it.fontSize * 1.18;
  const textH = lines.length * lineH;
  const h = textH + pad * 2;
  // An ellipse needs about sqrt(2) of the text box to clear its corners.
  const rx = it.style === "box" ? it.w / 2 : (it.w / 2) * 1.2 + 10;
  const ry = it.style === "box" ? h / 2 : (h / 2) * 1.32 + 12;
  return { lines, lineH, textH, h, rx, ry };
}

function Bubble({ it }: { it: Extract<Item, { t: "bubble" }> }) {
  const { lines, lineH, textH, rx, ry } = bubbleLayout(it);
  const { x, y } = it;
  const sw = it.style === "shout" ? 4.5 : 3.5;
  const tail = it.tail && it.style !== "box" ? it.tail : null;

  let tailShape: ReactNode = null;
  let tailCover: ReactNode = null;
  if (tail) {
    const dx = tail.x - x;
    const dy = tail.y - y;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    const base = it.style === "shout" ? Math.min(26, rx * 0.3) : Math.min(44, rx * 0.4);
    if (it.style === "thought") {
      const edge = Math.min(1, Math.hypot(rx * dx / len, ry * dy / len) / len);
      tailShape = [0.2, 0.52, 0.8].map((f, i) => {
        const t = edge + (1 - edge) * f;
        return <circle key={i} cx={x + dx * t} cy={y + dy * t} r={12 - i * 3.5} fill="#fff" stroke="#000" strokeWidth={3} />;
      });
    } else {
      const d = `M${x + (px * base) / 2} ${y + (py * base) / 2}L${tail.x} ${tail.y}L${x - (px * base) / 2} ${y - (py * base) / 2}Z`;
      const dash = it.style === "whisper" ? "9 7" : undefined;
      tailShape = <path d={d} fill="#fff" stroke="#000" strokeWidth={sw} strokeLinejoin="round" strokeDasharray={dash} />;
      tailCover = <path d={d} fill="#fff" />;
    }
  }

  let body: ReactNode;
  switch (it.style) {
    case "box":
      body = <rect x={x - rx} y={y - ry} width={rx * 2} height={ry * 2} fill="#fff" stroke="#000" strokeWidth={3} />;
      break;
    case "shout": {
      const n = Math.max(14, Math.round((rx + ry) / 14));
      const pts = Array.from({ length: n * 2 }, (_, i) => {
        const a = (i / (n * 2)) * Math.PI * 2;
        const k = i % 2 === 0 ? 1.22 : 0.98;
        return `${(x + Math.cos(a) * rx * k).toFixed(1)},${(y + Math.sin(a) * ry * k).toFixed(1)}`;
      });
      body = <polygon points={pts.join(" ")} fill="#fff" stroke="#000" strokeWidth={sw} strokeLinejoin="miter" />;
      break;
    }
    case "thought": {
      const n = Math.max(8, Math.round((rx + ry) / 26));
      const pr = Math.min(rx, ry) * 0.42;
      body = (
        <>
          {Array.from({ length: n }, (_, i) => {
            const a = (i / n) * Math.PI * 2;
            return <circle key={i} cx={x + Math.cos(a) * rx * 0.92} cy={y + Math.sin(a) * ry * 0.92} r={pr} fill="#fff" stroke="#000" strokeWidth={3} />;
          })}
          <ellipse cx={x} cy={y} rx={rx * 0.93} ry={ry * 0.93} fill="#fff" />
        </>
      );
      break;
    }
    default:
      body = <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#fff" stroke="#000" strokeWidth={sw} strokeDasharray={it.style === "whisper" ? "9 7" : undefined} />;
  }

  const top = y - textH / 2;
  return (
    <g transform={it.rot ? `rotate(${it.rot} ${x} ${y})` : undefined}>
      {tailShape}
      {body}
      {tailCover}
      <text textAnchor="middle" fontFamily={FONTS.letter} fontWeight={LETTER_WEIGHT} fontSize={it.fontSize} fill="#000">
        {lines.map((l, i) => (
          <tspan key={i} x={x} y={top + i * lineH + it.fontSize * 0.92}>
            {l}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function Sfx({ it, color }: { it: Extract<Item, { t: "sfx" }>; color: boolean }) {
  return (
    <text
      x={it.x}
      y={it.y}
      dy="0.35em"
      textAnchor="middle"
      transform={`rotate(${it.rot} ${it.x} ${it.y})`}
      fontFamily={it.font === "dela" ? FONTS.dela : FONTS.bangers}
      fontSize={it.size}
      letterSpacing={it.font === "bangers" ? it.size * 0.03 : 0}
      fill={tint(it.fill, color)}
      stroke={tint(it.stroke, color)}
      strokeWidth={it.size * 0.13}
      strokeLinejoin="round"
      paintOrder="stroke"
    >
      {it.text}
    </text>
  );
}

/** Manga emotes, drawn in a 100 x 100 box. */
export function EmoteArt({ kind, ink }: { kind: Emote; ink: string }) {
  const st = { fill: "none", stroke: ink, strokeWidth: 7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "sweat":
      return <path d="M50 8C38 34 26 50 26 66a24 24 0 0 0 48 0C74 50 62 34 50 8Z" fill="#fff" stroke={ink} strokeWidth={6} />;
    case "anger":
      return <path {...st} strokeWidth={9} d="M40 12q0 26-28 28M60 12q0 26 28 28M40 88q0-26-28-28M60 88q0-26 28-28" />;
    case "heart":
      return <path d="M50 88C18 66 6 48 6 32A22 22 0 0 1 50 22a22 22 0 0 1 44 10c0 16-12 34-44 56Z" fill={ink} />;
    case "shock":
      return <path {...st} strokeWidth={8} d="M50 6v42M50 70v4M20 14l12 26M80 14l-12 26" />;
    case "question":
      return <text x="50" y="84" textAnchor="middle" fontFamily={FONTS.dela} fontSize="92" fill={ink}>?</text>;
    case "dots":
      return (
        <g fill={ink}>
          <circle cx="18" cy="60" r="8" />
          <circle cx="50" cy="60" r="8" />
          <circle cx="82" cy="60" r="8" />
        </g>
      );
    case "zzz":
      return <text x="50" y="72" textAnchor="middle" fontFamily={FONTS.bangers} fontSize="62" fill={ink}>Zzz</text>;
    case "sparkles":
      return (
        <g fill={ink}>
          <path d="M40 8Q40 40 72 40Q40 40 40 72Q40 40 8 40Q40 40 40 8Z" />
          <path d="M78 58Q78 74 94 74Q78 74 78 90Q78 74 62 74Q78 74 78 58Z" />
        </g>
      );
    case "note":
      return <path d="M36 78a14 11 0 1 1-4-22V14l46-8v58a14 11 0 1 1-4-22V24l-38 7Z" fill={ink} />;
    case "tear":
      return <path {...st} d="M30 10q-8 20 0 40t0 40M70 10q8 20 0 40t0 40" />;
  }
}

function ItemView({ it, art, color }: { it: Item; art: Map<string, FriendArt>; color: boolean }) {
  switch (it.t) {
    case "friend":
      return <FriendSprite it={it} art={art.get(friendKey(it.friend))} color={color} />;
    case "bubble":
      return <Bubble it={it} />;
    case "sfx":
      return <Sfx it={it} color={color} />;
    case "emote":
      return (
        <g transform={`translate(${it.x} ${it.y}) rotate(${it.rot}) scale(${it.size / 100}) translate(-50 -50)`}>
          <EmoteArt kind={it.kind} ink={tint(it.ink, color)} />
        </g>
      );
    case "prop": {
      const k = it.size / PROP_BOX.width;
      return (
        <g transform={`translate(${it.x} ${it.y}) rotate(${it.rot}) scale(${k}) translate(${-PROP_BOX.anchorX} ${-PROP_BOX.anchorY})`}>
          <image href={propImage(it.type, color)} width={PROP_BOX.width} height={PROP_BOX.height} />
        </g>
      );
    }
  }
}

function PageSvgInner({ page, color, art, uid, className, svgRef, children, title }: PageSvgProps) {
  const gutter = page.gutter === "black" ? "#000" : "#fff";
  const border = page.gutter === "black" ? "#fff" : "#000";
  const panels = useMemo(() => page.panels.map((_, i) => ({ pts: panelPoints(page.layout, i), box: panelBox(page.layout, i) })), [page.layout, page.panels]);
  return (
    <svg ref={svgRef} className={className} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} width={PAGE_W} height={PAGE_H} role="img" aria-label={title ?? "Manga page"}>
      <defs>
        <Tones uid={uid} />
        {panels.map((p, i) => (
          <clipPath key={i} id={`${uid}-clip${i}`}>
            <polygon points={p.pts.map((q) => q.join(",")).join(" ")} />
          </clipPath>
        ))}
      </defs>
      <rect width={PAGE_W} height={PAGE_H} fill={gutter} />
      {page.panels.map((panel, i) => (
        <g key={i} data-panel={i}>
          <g clipPath={`url(#${uid}-clip${i})`}>
            <PanelBackground bg={panel.bg} box={panels[i].box} uid={uid} seed={(i + 1) * 7919 + page.layout.length} color={color} art={art} />
            {page.items.map((it) => ("panel" in it && it.panel === i ? <g key={it.id} data-item={it.id}><ItemView it={it} art={art} color={color} /></g> : null))}
          </g>
          <polygon points={panels[i].pts.map((q) => q.join(",")).join(" ")} fill="none" stroke={border} strokeWidth={5} strokeLinejoin="miter" pointerEvents="none" />
        </g>
      ))}
      {page.items.map((it) => ("panel" in it ? null : <g key={it.id} data-item={it.id}><ItemView it={it} art={art} color={color} /></g>))}
      {children}
    </svg>
  );
}

export const PageSvg = memo(PageSvgInner);
