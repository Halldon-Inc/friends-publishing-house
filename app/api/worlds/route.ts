import { NextResponse } from "next/server";
import { assertSameOrigin, handle, rateLimit, readBody } from "@/lib/api";
import { createWorld, listWorlds } from "@/lib/db";
import { requireHolder } from "@/lib/session";

export const dynamic = "force-dynamic";
export const GET = handle(async () => {
  const s = await requireHolder();
  return NextResponse.json({ worlds: await listWorlds(s.address) }, { headers: { "cache-control": "private, no-store" } });
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const s = await requireHolder();
  rateLimit(`create:${s.address}`, 20, 60_000);
  return NextResponse.json({ world: await createWorld(s.address, await readBody(req, 100_000)) });
});
