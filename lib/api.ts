import "server-only";
import { NextResponse } from "next/server";
import { AuthError } from "./session";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Wraps a route handler so thrown AuthError / HttpError become JSON errors and anything else a logged 500. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof AuthError || e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(JSON.stringify({ tag: "fph-api", error: String((e as Error)?.stack ?? e).slice(0, 800) }));
      return NextResponse.json({ error: "Something went wrong on our side. Try again." }, { status: 500 });
    }
  };
}

export async function readBody(req: Request, maxBytes: number): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new HttpError(413, "That is too big to save.");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "That is too big to save.");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Expected JSON.");
  }
}

/** Same-origin check for state-changing requests (cookies are SameSite=Lax, this closes the rest). */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host === host) return;
  } catch {
    // fall through
  }
  throw new HttpError(403, "Cross-site request refused.");
}

const buckets = new Map<string, number[]>();
/** A small per-instance sliding window. Not a security boundary, just a brake on runaway clients. */
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) throw new HttpError(429, "Slow down a little and try again in a minute.");
  hits.push(now);
  buckets.set(key, hits);
}
