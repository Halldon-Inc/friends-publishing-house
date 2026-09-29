import { NextResponse } from "next/server";
import { assertSameOrigin, handle, HttpError, rateLimit, readBody } from "@/lib/api";
import { beginPublish, finishPublish, publishAssetKey, unpublish } from "@/lib/db";
import { requireHolder } from "@/lib/session";
import { putObject } from "@/lib/storage";

/**
 * Publishing is three steps so no single request carries more than one page image (Vercel caps bodies at 4.5 MB):
 *   POST   reserve the link and version             -> { slug, version, pages }
 *   PUT    ?slug&version&asset=p1..pN|card           one PNG rendered in the browser
 *   PATCH  { slug, version }                         check every image arrived, then go live
 *   DELETE                                           take it down
 */
type Ctx = { params: Promise<{ id: string }> };
const PAGE_SIZE = { w: 1200, h: 1800 };
const CARD_SIZE = { w: 1200, h: 630 };
const MAX_PNG = 4_000_000;

export const POST = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const s = await requireHolder();
  rateLimit(`publish:${s.address}`, 10, 10 * 60_000);
  return NextResponse.json(await beginPublish(s.address, (await ctx.params).id));
});

export const PUT = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const s = await requireHolder();
  rateLimit(`asset:${s.address}`, 200, 10 * 60_000);
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") ?? "";
  const version = Number(url.searchParams.get("version"));
  const asset = url.searchParams.get("asset") ?? "";
  const key = await publishAssetKey(s.address, (await ctx.params).id, slug, version, asset);
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length > MAX_PNG) throw new HttpError(413, "That page image is too large.");
  // PNG signature, then the IHDR chunk's width and height at bytes 16 to 24.
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a || buf.toString("ascii", 12, 16) !== "IHDR") throw new HttpError(400, "Pages must be PNG images.");
  const want = asset === "card" ? CARD_SIZE : PAGE_SIZE;
  if (buf.readUInt32BE(16) !== want.w || buf.readUInt32BE(20) !== want.h) throw new HttpError(400, `Expected a ${want.w}x${want.h} image.`);
  await putObject(key, buf, "image/png", { cacheSeconds: 31_536_000 });
  return NextResponse.json({ ok: true });
});

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const s = await requireHolder();
  const body = (await readBody(req, 1_000)) as { slug?: unknown; version?: unknown };
  if (typeof body.slug !== "string" || typeof body.version !== "number") throw new HttpError(400, "Missing publish details.");
  const meta = await finishPublish(s.address, (await ctx.params).id, body.slug, body.version);
  return NextResponse.json({ slug: meta.slug, version: meta.version });
});

export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const s = await requireHolder();
  await unpublish(s.address, (await ctx.params).id);
  return NextResponse.json({ ok: true });
});
