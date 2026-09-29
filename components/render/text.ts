"use client";

/** Font stacks. The same woff2 files are declared in globals.css and embedded into exported pages. */
export const FONTS = {
  letter: "'Comic Neue', 'Comic Sans MS', sans-serif",
  bangers: "Bangers, Impact, sans-serif",
  dela: "'Dela Gothic One', 'Arial Black', sans-serif",
  ui: "'Space Grotesk', system-ui, sans-serif",
} as const;
export const LETTER_WEIGHT = 700;

let ctx: CanvasRenderingContext2D | null = null;
function measurer() {
  if (ctx || typeof document === "undefined") return ctx;
  ctx = document.createElement("canvas").getContext("2d");
  return ctx;
}

export function textWidth(text: string, fontSize: number, family: string = FONTS.letter, weight = LETTER_WEIGHT): number {
  const c = measurer();
  if (!c) return text.length * fontSize * 0.55;
  c.font = `${weight} ${fontSize}px ${family}`;
  return c.measureText(text).width;
}

/** Greedy word wrap that respects typed line breaks; a word longer than the line is broken by characters. */
export function wrap(text: string, fontSize: number, maxWidth: number, family: string = FONTS.letter): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (textWidth(next, fontSize, family) <= maxWidth) {
        line = next;
        continue;
      }
      if (line) out.push(line);
      if (textWidth(word, fontSize, family) <= maxWidth) {
        line = word;
        continue;
      }
      let chunk = "";
      for (const ch of word) {
        if (textWidth(chunk + ch, fontSize, family) > maxWidth && chunk) {
          out.push(chunk);
          chunk = ch;
        } else chunk += ch;
      }
      line = chunk;
    }
    out.push(line);
  }
  return out.length ? out : [""];
}

let fontsReady: Promise<void> | null = null;
/** Resolves once every page font is loaded, so measurement and export match what is on screen. */
export function loadPageFonts(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  fontsReady ??= Promise.all([
    document.fonts.load(`700 24px 'Comic Neue'`),
    document.fonts.load(`400 24px Bangers`),
    document.fonts.load(`400 24px 'Dela Gothic One'`),
  ]).then(() => undefined, () => undefined);
  return fontsReady;
}
