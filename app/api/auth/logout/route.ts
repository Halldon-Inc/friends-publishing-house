import { NextResponse } from "next/server";
import { assertSameOrigin, handle } from "@/lib/api";
import { endSession } from "@/lib/session";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  await endSession();
  return NextResponse.json({ ok: true });
});
