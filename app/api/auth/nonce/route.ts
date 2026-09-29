import { NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { assertSameOrigin, handle, HttpError, rateLimit, readBody } from "@/lib/api";
import { issueNonce } from "@/lib/session";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const body = (await readBody(req, 1_000)) as { address?: unknown };
  if (typeof body.address !== "string" || !isAddress(body.address)) throw new HttpError(400, "No wallet address.");
  const address = getAddress(body.address);
  rateLimit(`nonce:${address}`, 20, 60_000);
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return NextResponse.json({ message: await issueNonce(address, host, `${proto}://${host}`) });
});
