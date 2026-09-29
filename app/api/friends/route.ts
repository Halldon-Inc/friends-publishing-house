import { NextResponse } from "next/server";
import { getAddress } from "viem";
import { handle, HttpError } from "@/lib/api";
import { ownedFriends } from "@/lib/chain";
import { devLoginAddress, requireHolder } from "@/lib/session";

export const dynamic = "force-dynamic";
/** The signed-in holder's Friends. In local dev sign-in, the cast is read (read-only) from DEV_CAST_WALLET. */
export const GET = handle(async () => {
  const s = await requireHolder();
  const cast = s.address === devLoginAddress() && process.env.DEV_CAST_WALLET ? getAddress(process.env.DEV_CAST_WALLET) : s.address;
  try {
    return NextResponse.json({ friends: await ownedFriends(cast) }, { headers: { "cache-control": "private, no-store" } });
  } catch {
    throw new HttpError(503, "Could not load your Friends from rarefriends.com right now. You can still add any Friend by number.");
  }
});
