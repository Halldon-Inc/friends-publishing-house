import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getAddress, type Address } from "viem";
import { isHolder } from "./chain";

/**
 * Wallet sign-in: the server hands out a nonce (in a signed cookie), the wallet signs a plain-text message
 * containing it, the server verifies the signature and that the wallet holds a Friend, and then sets a signed
 * session cookie. Nothing is stored server-side. Holder status is re-read from chain every HOLDER_RECHECK.
 */
const SESSION_COOKIE = "fph_session";
const NONCE_COOKIE = "fph_nonce";
const SESSION_TTL = 7 * 24 * 3600_000;
const NONCE_TTL = 10 * 60_000;
const HOLDER_RECHECK = 15 * 60_000;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET (32+ chars) is required in production");
  return "dev-only-secret-do-not-use-in-production-000000";
}
const b64 = (s: string) => Buffer.from(s).toString("base64url");
const mac = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");
function seal(value: unknown) {
  const p = b64(JSON.stringify(value));
  return `${p}.${mac(p)}`;
}
function unseal<T>(token: string | undefined): T | null {
  if (!token) return null;
  const [p, sig] = token.split(".");
  if (!p || !sig) return null;
  const want = Buffer.from(mac(p));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    return JSON.parse(Buffer.from(p, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
const cookieOpts = (maxAgeMs: number) => ({ httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: Math.floor(maxAgeMs / 1000) });

// ===== sign-in message =====
export function signInMessage(host: string, origin: string, address: Address, nonce: string, issuedAt: Date) {
  const expires = new Date(issuedAt.getTime() + NONCE_TTL);
  return [
    `${host} wants you to sign in with your Ethereum account:`,
    address,
    "",
    "Sign in to Friends Publishing House. This is free and sends no transaction.",
    "",
    `URI: ${origin}`,
    "Version: 1",
    "Chain ID: 4663",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
    `Expiration Time: ${expires.toISOString()}`,
  ].join("\n");
}

export async function issueNonce(address: Address, host: string, origin: string) {
  const nonce = randomBytes(12).toString("hex");
  const message = signInMessage(host, origin, address, nonce, new Date());
  (await cookies()).set(NONCE_COOKIE, seal({ n: nonce, a: address, exp: Date.now() + NONCE_TTL }), cookieOpts(NONCE_TTL));
  return message;
}

/** The nonce cookie must match the message's address and nonce and the message must name this host. One use only. */
export async function consumeNonce(message: string, host: string): Promise<Address | null> {
  const jar = await cookies();
  const n = unseal<{ n: string; a: string; exp: number }>(jar.get(NONCE_COOKIE)?.value);
  jar.delete(NONCE_COOKIE);
  if (!n || n.exp < Date.now()) return null;
  const lines = message.split("\n");
  if (lines[0] !== `${host} wants you to sign in with your Ethereum account:`) return null;
  if (lines[1] !== n.a || !lines.includes(`Nonce: ${n.n}`)) return null;
  return getAddress(n.a);
}

// ===== session =====
type SessionToken = { a: string; h: number; exp: number };
export type Session = { address: Address; holder: true };

export async function startSession(address: Address) {
  (await cookies()).set(SESSION_COOKIE, seal({ a: address, h: Date.now(), exp: Date.now() + SESSION_TTL } satisfies SessionToken), cookieOpts(SESSION_TTL));
}
export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export class AuthError extends Error {
  constructor(public status: 401 | 403 | 503, message: string) {
    super(message);
  }
}

/** The signed-in holder, or null. Rechecks holder status on chain when the last check is older than HOLDER_RECHECK. */
export async function readSession(): Promise<Session | null> {
  const jar = await cookies();
  const t = unseal<SessionToken>(jar.get(SESSION_COOKIE)?.value);
  if (!t || t.exp < Date.now()) return null;
  const address = getAddress(t.a);
  if (Date.now() - t.h > HOLDER_RECHECK && !isDevAddress(address)) {
    let holder: boolean;
    try {
      holder = await isHolder(address);
    } catch {
      // The chain is unreachable: keep the session on its last good check rather than lock creators out.
      return { address, holder: true };
    }
    if (!holder) {
      jar.delete(SESSION_COOKIE);
      return null;
    }
    try {
      jar.set(SESSION_COOKIE, seal({ ...t, h: Date.now() }), cookieOpts(t.exp - Date.now()));
    } catch {
      // Server components cannot set cookies; the next API call refreshes it.
    }
  }
  return { address, holder: true };
}

export async function requireHolder(): Promise<Session> {
  const s = await readSession();
  if (!s) throw new AuthError(401, "Sign in with a wallet that holds a Rare Friend.");
  return s;
}

/** Local development only: a sign-in that skips the wallet, as the address in DEV_LOGIN_ADDRESS. */
export const devLoginAddress = (): Address | null => {
  const a = process.env.DEV_LOGIN_ADDRESS;
  return process.env.NODE_ENV !== "production" && a && /^0x[0-9a-fA-F]{40}$/.test(a) ? getAddress(a) : null;
};
const isDevAddress = (a: Address) => devLoginAddress() === a;
