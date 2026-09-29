"use client";
import { loadPageFonts } from "./text";

/**
 * The 1200 x 630 share card X, Farcaster, Discord and Telegram unfurl: the cover page on the right, the title in
 * big type on a screentoned black field on the left. Drawn on a canvas from the already rendered cover PNG.
 */
export async function makeShareCard(cover: Blob, info: { title: string; by: string; pages: number; color: boolean }): Promise<Blob> {
  await loadPageFonts();
  await document.fonts.load("400 20px Silkscreen").catch(() => undefined);
  const W = 1200;
  const H = 630;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;

  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);
  // halftone ramp across the black field
  for (let y = 10; y < H; y += 14) {
    for (let x = 10; x < 760; x += 14) {
      const r = Math.max(0, ((x - 300) / 460) * 3.2);
      if (r <= 0.2) continue;
      g.fillStyle = "#1d1d1d";
      g.beginPath();
      g.arc(x + ((y / 14) % 2) * 7, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }

  const img = await createImageBitmap(cover);
  const ph = H - 60;
  const pw = (img.width / img.height) * ph;
  const px = W - pw - 44;
  const py = 30;
  g.save();
  g.translate(px + pw / 2, py + ph / 2);
  g.rotate((2.2 * Math.PI) / 180);
  g.fillStyle = info.color ? "#CCFF00" : "#fff";
  g.fillRect(-pw / 2 + 12, -ph / 2 + 12, pw, ph);
  g.drawImage(img, -pw / 2, -ph / 2, pw, ph);
  g.strokeStyle = "#fff";
  g.lineWidth = 4;
  g.strokeRect(-pw / 2, -ph / 2, pw, ph);
  g.restore();

  const left = 56;
  const maxW = px - left - 50;
  g.fillStyle = "#CCFF00";
  g.font = "400 22px Silkscreen, monospace";
  g.textBaseline = "top";
  g.fillText("FRIENDS PUBLISHING HOUSE", left, 52);

  // Title: largest size (down to 44px) that fits in four lines.
  let size = 96;
  let lines: string[] = [];
  for (; size >= 44; size -= 4) {
    g.font = `400 ${size}px 'Dela Gothic One', sans-serif`;
    lines = [];
    let line = "";
    for (const word of info.title.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (g.measureText(next).width <= maxW || !line) line = next;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    if (lines.length <= 4 && lines.every((l) => g.measureText(l).width <= maxW)) break;
  }
  g.fillStyle = "#fff";
  const lh = size * 1.08;
  const top = 110 + Math.max(0, (4 - lines.length) * lh * 0.35);
  lines.slice(0, 4).forEach((l, i) => g.fillText(l, left, top + i * lh));

  g.font = "700 30px 'Space Grotesk', sans-serif";
  g.fillStyle = "#fff";
  g.fillText(`by ${info.by}`, left, H - 118);
  g.font = "400 18px Silkscreen, monospace";
  g.fillStyle = "#9a9a9a";
  g.fillText(`${info.pages} PAGE${info.pages === 1 ? "" : "S"} · ${info.color ? "COLOUR" : "B&W"} · READ FREE`, left, H - 72);

  return new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Card encoding failed."))), "image/png"));
}
