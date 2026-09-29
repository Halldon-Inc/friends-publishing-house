"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Eip1193 = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };
declare global {
  interface Window {
    ethereum?: Eip1193;
  }
}

type SessionState = {
  address: string | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  devLogin: boolean;
  signIn(): Promise<void>;
  signInDev(): Promise<void>;
  signOut(): Promise<void>;
};
const Ctx = createContext<SessionState | null>(null);

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : `Request failed (${r.status})`);
  return j;
}

/**
 * Wallet sign-in: ask the injected wallet for an account, have it sign the server's message (free, no transaction),
 * and let the server check the signature and that the wallet holds a Friend.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devLogin, setDevLogin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { address: string | null; dev?: boolean }) => {
        setAddress(j.address);
        setDevLogin(Boolean(j.dev));
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    const eth = window.ethereum;
    if (!eth) {
      setError("No wallet found in this browser. Open the site in your wallet app's browser, or install a wallet extension.");
      return;
    }
    setBusy(true);
    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const account = accounts?.[0];
      if (!account) throw new Error("The wallet did not share an account.");
      const { message } = (await post("/api/auth/nonce", { address: account })) as { message: string };
      const hexMsg = `0x${Array.from(new TextEncoder().encode(message), (b) => b.toString(16).padStart(2, "0")).join("")}`;
      const signature = (await eth.request({ method: "personal_sign", params: [hexMsg, account] })) as string;
      const j = (await post("/api/auth/verify", { message, signature })) as { address: string };
      setAddress(j.address);
    } catch (e) {
      const m = (e as { code?: number; message?: string })?.code === 4001 ? "Signature cancelled." : ((e as Error)?.message ?? "Sign-in failed.");
      setError(m);
    } finally {
      setBusy(false);
    }
  }, []);

  const signInDev = useCallback(async () => {
    setBusy(true);
    try {
      const j = (await post("/api/auth/dev", {})) as { address: string };
      setAddress(j.address);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await post("/api/auth/logout", {}).catch(() => undefined);
    setAddress(null);
  }, []);

  return <Ctx.Provider value={{ address, loading, busy, error, devLogin, signIn, signInDev, signOut }}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}

/** fetch + JSON with the API's `{ error }` convention. */
export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const r = await fetch(url, { ...rest, headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...rest.headers }, body: json !== undefined ? JSON.stringify(json) : rest.body, cache: "no-store" });
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : `Request failed (${r.status})`);
  return j as T;
}
