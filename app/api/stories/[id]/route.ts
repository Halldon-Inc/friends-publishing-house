import { NextResponse } from "next/server";
import { assertSameOrigin, handle, rateLimit, readBody } from "@/lib/api";
import { deleteStory, getStory, saveStory } from "@/lib/db";
import { requireHolder } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const s = await requireHolder();
  return NextResponse.json({ story: await getStory(s.address, (await ctx.params).id) }, { headers: { "cache-control": "private, no-store" } });
});

export const PUT = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const s = await requireHolder();
  rateLimit(`save:${s.address}`, 90, 60_000);
  const body = await readBody(req, 1_500_000);
  return NextResponse.json({ story: await saveStory(s.address, (await ctx.params).id, body) });
});

export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const s = await requireHolder();
  await deleteStory(s.address, (await ctx.params).id);
  return NextResponse.json({ ok: true });
});
