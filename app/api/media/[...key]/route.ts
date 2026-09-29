import { readLocal } from "@/lib/storage";

/** Local development storage only. In production published pages are served by Vercel Blob and this returns 404. */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const key = (await ctx.params).key.join("/");
  // Drafts, worlds and pending publishes are private: only published page images are served.
  if (!key.startsWith("pub/") || !key.endsWith(".png")) return new Response("Not found", { status: 404 });
  const buf = await readLocal(key).catch(() => null);
  if (!buf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(buf), { headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable" } });
}
