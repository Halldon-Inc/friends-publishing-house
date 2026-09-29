"use client";
import { useEffect, useState } from "react";
import { artRows, rowsToPath, type FriendArt } from "@/lib/art";
import { friendKey, type Collection, type FriendRef } from "@/lib/model";
import { useArt } from "./useArt";
import { api } from "./useSession";

export function FriendIcon({ art, size = 48, facing = "down" }: { art: FriendArt | undefined; size?: number; facing?: "down" | "left" | "right" | "up" }) {
  if (!art) return <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden><rect x="2" y="2" width="12" height="12" fill="none" stroke="#000" strokeDasharray="2 2" /></svg>;
  const rows = artRows(art, facing, "idle", 0);
  const w = rows[0]?.length ?? 8;
  return (
    <svg width={size} height={size} viewBox={`-1 -1 ${w + 2} ${rows.length + 2}`} shapeRendering="crispEdges" aria-hidden>
      <path d={rowsToPath(rows)} fill="#000" />
    </svg>
  );
}

let ownedCache: FriendRef[] | null = null;

/** Your Friends (from your wallet) plus any Friend by number as a guest star. */
export function FriendPicker({ onPick, label = "Add to page" }: { onPick(f: FriendRef): void; label?: string }) {
  const [owned, setOwned] = useState<FriendRef[] | null>(ownedCache);
  const [err, setErr] = useState<string | null>(null);
  const [limit, setLimit] = useState(24);
  const [guestC, setGuestC] = useState<Collection>("Generations");
  const [guestId, setGuestId] = useState("");
  useEffect(() => {
    if (ownedCache) return;
    api<{ friends: FriendRef[] }>("/api/friends").then(
      (j) => {
        ownedCache = j.friends;
        setOwned(j.friends);
      },
      (e) => {
        setErr(e.message);
        setOwned([]);
      },
    );
  }, []);
  const shown = (owned ?? []).slice(0, limit);
  const { art } = useArt(shown);
  const guestOk = /^[1-9][0-9]{0,9}$/.test(guestId);
  return (
    <div>
      {owned === null ? <p className="hint">Loading your Friends…</p> : null}
      {err ? <p className="hint">{err}</p> : null}
      {owned && owned.length === 0 && !err ? <p className="hint">No Friends found in this wallet. Add one by number below.</p> : null}
      <div className="cast">
        {shown.map((f) => (
          <button key={friendKey(f)} className="tile" onClick={() => onPick(f)} title={`${label}: ${f.c} #${f.id}`}>
            <FriendIcon art={art.get(friendKey(f))} />
            <span>{f.c === "Genesis" ? "G" : "Gen"} #{f.id}</span>
          </button>
        ))}
      </div>
      {owned && owned.length > limit ? (
        <button className="btn small" style={{ marginTop: 8 }} onClick={() => setLimit((l) => l + 24)}>
          Show more ({owned.length - limit})
        </button>
      ) : null}
      <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
        <span>Guest star (any Friend by number)</span>
        <div className="row-btns">
          <select value={guestC} onChange={(e) => setGuestC(e.target.value as Collection)} style={{ width: "auto" }} aria-label="Collection">
            <option value="Generations">Generations</option>
            <option value="Genesis">Genesis</option>
          </select>
          <input type="text" inputMode="numeric" placeholder="#" value={guestId} onChange={(e) => setGuestId(e.target.value.replace(/\D/g, "").slice(0, 10))} style={{ width: 90 }} aria-label="Token number" />
          <button className="btn small" disabled={!guestOk} onClick={() => onPick({ c: guestC, id: guestId })}>Add</button>
        </div>
      </div>
    </div>
  );
}
