"use client";
import { useEffect, useMemo, useState } from "react";
import { isArt, type FriendArt } from "@/lib/art";
import { friendKey, type FriendRef } from "@/lib/model";

/** Friend artwork shared across every component on the page: one fetch per Friend, ever. */
const store = new Map<string, FriendArt>();
const inflight = new Map<string, Promise<FriendArt | null>>();
const failed = new Set<string>();
const listeners = new Set<() => void>();

export function loadArt(f: FriendRef): Promise<FriendArt | null> {
  const key = friendKey(f);
  const have = store.get(key);
  if (have) return Promise.resolve(have);
  if (failed.has(key)) return Promise.resolve(null);
  let p = inflight.get(key);
  if (!p) {
    p = fetch(`/api/art/${f.c.toLowerCase()}/${f.id}`)
      .then(async (r) => {
        const j = r.ok ? await r.json() : null;
        if (!isArt(j)) {
          failed.add(key);
          return null;
        }
        store.set(key, j);
        listeners.forEach((l) => l());
        return j;
      })
      .catch(() => null)
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

export function useArt(friends: FriendRef[]): { art: Map<string, FriendArt>; missing: string[] } {
  const [tick, setTick] = useState(0);
  const keys = friends.map(friendKey).sort().join(",");
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  useEffect(() => {
    friends.forEach((f) => void loadArt(f));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);
  return useMemo(() => {
    const art = new Map<string, FriendArt>();
    const missing: string[] = [];
    for (const f of friends) {
      const k = friendKey(f);
      const a = store.get(k);
      if (a) art.set(k, a);
      else if (failed.has(k)) missing.push(k);
    }
    return { art, missing };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, tick]);
}

/** Resolves when every listed Friend's art has loaded or failed (used before export). */
export async function artReady(friends: FriendRef[]) {
  await Promise.all(friends.map(loadArt));
  const art = new Map<string, FriendArt>();
  for (const f of friends) {
    const a = store.get(friendKey(f));
    if (a) art.set(friendKey(f), a);
  }
  return art;
}
