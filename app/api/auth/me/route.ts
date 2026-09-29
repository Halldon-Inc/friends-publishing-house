import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { devLoginAddress, readSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const GET = handle(async () => {
  const s = await readSession();
  return NextResponse.json({ address: s?.address ?? null, dev: Boolean(devLoginAddress()) }, { headers: { "cache-control": "no-store" } });
});
