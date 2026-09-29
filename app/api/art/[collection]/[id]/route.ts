import { NextResponse } from "next/server";
import { handle, HttpError, rateLimit } from "@/lib/api";
import { friendArt } from "@/lib/chain";

/** Public: a Friend's artwork as pixel rows. Art is on-chain and effectively immutable, so it caches hard. */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ collection: string; id: string }> }) => {
  const { collection, id } = await ctx.params;
  const c = collection === "genesis" ? "Genesis" : collection === "generations" ? "Generations" : null;
  if (!c || !/^[1-9][0-9]{0,9}$/.test(id)) throw new HttpError(404, "No such Friend.");
  rateLimit(`art:${req.headers.get("x-forwarded-for") ?? "local"}`, 240, 60_000);
  try {
    const art = await friendArt({ c, id });
    return NextResponse.json(art, { headers: { "cache-control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800" } });
  } catch {
    throw new HttpError(404, `Could not find artwork for ${c} #${id}.`);
  }
});
