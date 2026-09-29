import { NextResponse } from "next/server";
import { isHex } from "viem";
import { assertSameOrigin, handle, HttpError, readBody } from "@/lib/api";
import { client, isHolder } from "@/lib/chain";
import { consumeNonce, startSession } from "@/lib/session";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const body = (await readBody(req, 8_000)) as { message?: unknown; signature?: unknown };
  if (typeof body.message !== "string" || typeof body.signature !== "string" || !isHex(body.signature)) throw new HttpError(400, "Missing signature.");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  const address = await consumeNonce(body.message, host);
  if (!address) throw new HttpError(401, "That sign-in request expired. Try again.");
  // viem's verifyMessage on a public client also accepts smart-contract wallets (ERC-1271 / ERC-6492).
  const ok = await client.verifyMessage({ address, message: body.message, signature: body.signature }).catch(() => false);
  if (!ok) throw new HttpError(401, "The signature did not match that wallet.");
  let holder: boolean;
  try {
    holder = await isHolder(address);
  } catch {
    throw new HttpError(503, "Could not reach Robinhood Chain to check your Friends. Try again in a moment.");
  }
  if (!holder) throw new HttpError(403, "This wallet holds no Rare Friends. The studio is for holders; reading is open to everyone.");
  await startSession(address);
  return NextResponse.json({ address });
});
