"use client";
import { loadPageFonts } from "./text";

/**
 * Rasterises a live page <svg> to PNG. The page fonts are inlined as data URIs (an SVG drawn as an image cannot
 * reach the document's fonts), world and prop art are already data URIs, and editor-only nodes are stripped.
 */
const FONT_FILES = [
  { family: "Comic Neue", weight: 700, file: "/fonts/comic-neue-700.woff2" },
  { family: "Bangers", weight: 400, file: "/fonts/bangers.woff2" },
  { family: "Dela Gothic One", weight: 400, file: "/fonts/dela-gothic-one.woff2" },
  { family: "Space Grotesk", weight: 700, file: "/fonts/space-grotesk-700.woff2" },
];
let fontCss: Promise<string> | null = null;
function embeddedFonts(): Promise<string> {
  fontCss ??= Promise.all(
    FONT_FILES.map(async (f) => {
      const buf = await (await fetch(f.file)).arrayBuffer();
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return `@font-face{font-family:'${f.family}';font-weight:${f.weight};src:url(data:font/woff2;base64,${btoa(bin)}) format('woff2');}`;
    }),
  ).then((x) => x.join(""));
  return fontCss;
}

export async function svgToPng(svg: SVGSVGElement, width: number, height: number): Promise<Blob> {
  await loadPageFonts();
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll("[data-editor]").forEach((n) => n.remove());
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = await embeddedFonts();
  clone.insertBefore(style, clone.firstChild);
  const markup = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("The page could not be drawn."));
      img.src = url;
    });
    // Give the image's embedded fonts a beat to settle before painting (Safari lays text out after onload).
    await new Promise((r) => setTimeout(r, 60));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encoding failed."))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
}
