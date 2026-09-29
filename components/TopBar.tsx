"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { shortAddr } from "@/lib/model";
import { useSession } from "./useSession";

/** The Genesis #259 portrait, used as the house mark. */
export const MARK = "M0 0h8v1h-8zM0 1h1v1h-1zM3 1h2v1h-2zM7 1h1v1h-1zM0 2h2v1h-2zM6 2h2v1h-2zM0 3h1v1h-1zM2 3h1v1h-1zM5 3h1v1h-1zM7 3h1v1h-1zM0 4h1v1h-1zM7 4h1v1h-1zM0 5h1v1h-1zM3 5h2v1h-2zM7 5h1v1h-1zM0 6h2v1h-2zM6 6h2v1h-2zM0 7h8v1h-8z";

export function TopBar() {
  const path = usePathname();
  const { address, signOut } = useSession();
  const cur = (p: string) => (path === p || (p !== "/" && path.startsWith(p)) ? "page" : undefined);
  if (path.startsWith("/embed")) return null;
  return (
    <nav className={`topbar${address ? " signed" : ""}`} aria-label="Main">
      <Link href="/" className="brand" aria-label="Friends Publishing House home">
        <svg width="30" height="30" viewBox="-1 -1 10 10" shapeRendering="crispEdges" aria-hidden>
          <rect x="-1" y="-1" width="10" height="10" fill="#CCFF00" />
          <path fill="#0a0a0a" d={MARK} />
        </svg>
        <span>
          <b>FRIENDS PUBLISHING HOUSE</b>
          <small>MANGA BY RARE FRIENDS HOLDERS</small>
        </span>
      </Link>
      <div className="nav">
        <Link href="/#shelf" className="hide-sm">Read</Link>
        <Link href="/studio" aria-current={cur("/studio")}>Studio</Link>
        {address ? (
          <span className="who">
            <span className="chip signal" title={address}>{shortAddr(address)}</span>
            <button className="btn small ghost" onClick={() => void signOut()}>Sign out</button>
          </span>
        ) : null}
      </div>
    </nav>
  );
}
