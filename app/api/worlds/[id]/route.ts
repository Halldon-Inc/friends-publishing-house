import { NextResponse } from "next/server";
import { assertSameOrigin, handle, rateLimit, readBody } from "@/lib/api";
import { deleteWorld, getWorld, saveWorld } from "@/lib/db";
import { requireHolder } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const s = await requireHolder();
  return NextResponse.json({ world: await getWorld(s.address, (await ctx.params).id) }, { headers: { "cache-control": "private, no-store" } });
});

export const PUT = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const s = await requireHolder();
  rateLimit(`save:${s.address}`, 90, 60_000);
  return NextResponse.json({ world: await saveWorld(s.address, (await ctx.params).id, await readBody(req, 100_000)) });
});

export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const s = await requireHolder();
  await deleteWorld(s.address, (await ctx.params).id);
  return NextResponse.json({ ok: true });
});
