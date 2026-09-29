import { NextResponse } from "next/server";
import { assertSameOrigin, handle, rateLimit, readBody } from "@/lib/api";
import { createStory, isSlug, listStories } from "@/lib/db";
import { requireHolder } from "@/lib/session";

export const dynamic = "force-dynamic";
export const GET = handle(async () => {
  const s = await requireHolder();
  const stories = await listStories(s.address);
  // The shelf needs the first page only.
  return NextResponse.json({ stories: stories.map((x) => ({ ...x, pages: x.pages.slice(0, 1), pageCount: x.pages.length })) }, { headers: { "cache-control": "private, no-store" } });
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const s = await requireHolder();
  rateLimit(`create:${s.address}`, 20, 60_000);
  const body = (await readBody(req, 1_000)) as { remixOf?: unknown };
  const remix = typeof body.remixOf === "string" && isSlug(body.remixOf) ? body.remixOf : undefined;
  return NextResponse.json({ story: await createStory(s.address, remix) });
});
