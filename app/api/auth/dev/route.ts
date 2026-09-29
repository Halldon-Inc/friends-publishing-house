import { NextResponse } from "next/server";
import { assertSameOrigin, handle, HttpError } from "@/lib/api";
import { devLoginAddress, startSession } from "@/lib/session";

/** Local development only (NODE_ENV !== production and DEV_LOGIN_ADDRESS set). 404 everywhere else. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const address = devLoginAddress();
  if (!address) throw new HttpError(404, "Not found.");
  await startSession(address);
  return NextResponse.json({ address });
});
