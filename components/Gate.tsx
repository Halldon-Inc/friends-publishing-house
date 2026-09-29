"use client";
import type { ReactNode } from "react";
import { useSession } from "./useSession";

/** Renders children only for a signed-in holder; otherwise the sign-in card. */
export function Gate({ children }: { children: ReactNode }) {
  const { address, loading, busy, error, devLogin, signIn, signInDev } = useSession();
  if (loading) return <div className="wrap" style={{ padding: 60 }}><span className="px">LOADING…</span></div>;
  if (address) return <>{children}</>;
  return (
    <div className="wrap">
      <div className="gate">
        <span className="chip dark">HOLDERS ONLY</span>
        <h1>The studio is for Friends.</h1>
        <p>Sign in with a wallet that holds a <b>Genesis</b> or <b>Generations</b> Rare Friend on Robinhood Chain. You sign one message to prove the wallet is yours. It is free and sends no transaction.</p>
        <p className="mute">No Friend? Every published issue is free to read and share.</p>
        <div className="row">
          <button className="btn primary big" onClick={() => void signIn()} disabled={busy}>
            {busy ? "Check your wallet…" : "Connect + sign in"}
          </button>
          {devLogin ? (
            <button className="btn big" onClick={() => void signInDev()} disabled={busy}>
              Dev sign-in (local only)
            </button>
          ) : null}
        </div>
        {error ? <div className="err" role="alert">{error}</div> : null}
      </div>
    </div>
  );
}
