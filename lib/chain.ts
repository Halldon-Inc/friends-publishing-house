import "server-only";
import { createPublicClient, defineChain, fallback, http, parseAbi, type Address } from "viem";
import { createGenerationSpriteReader, spriteFrame, SPRITE_FACINGS } from "@rarefriends/friendsdk/sprites";
import type { FriendArt } from "./art";
import { clipKey } from "./art";
import type { Collection, FriendRef } from "./model";
import { getJson, putJson } from "./storage";

/** Robinhood Chain mainnet and the two Rare Friends collections (verified on chain; see rare-friends-cards). */
export const CHAIN_ID = 4663;
export const COLLECTIONS: Record<Collection, Address> = {
  Genesis: "0x116EaA62241751E0c98dA43d458600c6C17cD361",
  Generations: "0x14C49e6118F46525dE9ab41a51cBAA3c6EBF181D",
};
const SITE = "https://rarefriends.com";
const UA = "friends-publishing-house/0.1";

const rpcs = [process.env.ROBINHOOD_RPC_URL, "https://rpc.mainnet.chain.robinhood.com", "https://rpc-robinhood.globalstake.io", "https://robinhood-rpc.publicnode.com"].filter((u): u is string => !!u);
export const robinhood = defineChain({
  id: CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: rpcs } },
  contracts: { multicall3: { address: "0xca11bde05977b3631167028862be2a173976ca11" } },
});
export const client = createPublicClient({ chain: robinhood, transport: fallback(rpcs.map((u) => http(u, { timeout: 6_000, retryCount: 1 }))) });

const ERC721 = parseAbi(["function balanceOf(address) view returns (uint256)", "function tokenURI(uint256) view returns (string)"]);

// ===== holder check =====
const holderMemo = new Map<string, { at: number; holder: boolean }>();
const HOLDER_TTL = 5 * 60_000;

/** True when the wallet holds at least one Genesis or Generations Friend. Throws when the chain cannot be read. */
export async function isHolder(address: Address): Promise<boolean> {
  const key = address.toLowerCase();
  const hit = holderMemo.get(key);
  if (hit && Date.now() - hit.at < HOLDER_TTL) return hit.holder;
  const [g, n] = await client.multicall({
    contracts: [
      { address: COLLECTIONS.Genesis, abi: ERC721, functionName: "balanceOf", args: [address] },
      { address: COLLECTIONS.Generations, abi: ERC721, functionName: "balanceOf", args: [address] },
    ],
    allowFailure: false,
  });
  const holder = g > 0n || n > 0n;
  holderMemo.set(key, { at: Date.now(), holder });
  return holder;
}

// ===== owned Friends =====
export type Owned = FriendRef;
const ownedMemo = new Map<string, { at: number; list: Owned[] }>();

/** rarefriends.com's public owned-nfts route (the same one their portfolio uses). Server-side only, never with an Origin header. */
export async function ownedFriends(address: Address): Promise<Owned[]> {
  const key = address.toLowerCase();
  const hit = ownedMemo.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.list;
  const res = await fetch(`${SITE}/api/protocol/owned-nfts?address=${address}`, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(10_000), cache: "no-store" });
  if (!res.ok) throw new Error(`owned-nfts ${res.status}`);
  const j = (await res.json()) as { nfts?: unknown };
  if (!Array.isArray(j.nfts)) throw new Error("owned-nfts: unexpected shape");
  const list = j.nfts
    .filter((n): n is { collection: Collection; id: string } => typeof n === "object" && n !== null && (n.collection === "Genesis" || n.collection === "Generations") && typeof n.id === "string" && /^[1-9][0-9]{0,9}$/.test(n.id))
    .slice(0, 500)
    .map((n) => ({ c: n.collection, id: n.id }));
  ownedMemo.set(key, { at: Date.now(), list });
  return list;
}

// ===== artwork =====
const ART_TTL = 7 * 24 * 3600_000;
const artMemo = new Map<string, FriendArt>();
const spriteReader = createGenerationSpriteReader(client);

/** Parse the Genesis 8 x 8 on-chain SVG (a white rect plus one black path of `M x y h w v1 h-w z` runs) into rows. */
export function genesisRows(svg: string): string[] | null {
  if (!/viewBox="0 0 8 8"/.test(svg)) return null;
  const grid = Array.from({ length: 8 }, () => Array(8).fill("."));
  const paths = [...svg.matchAll(/<path[^>]*fill="#0{3,6}"[^>]*d="([^"]+)"/g), ...svg.matchAll(/<path[^>]*d="([^"]+)"[^>]*fill="#0{3,6}"/g)];
  if (!paths.length) return null;
  for (const [, d] of paths) {
    for (const m of d.matchAll(/M(\d+) (\d+)h(\d+)v(\d+)h-\d+z/g)) {
      const [x, y, w, h] = [+m[1], +m[2], +m[3], +m[4]];
      for (let yy = y; yy < Math.min(8, y + h); yy++) for (let xx = x; xx < Math.min(8, x + w); xx++) grid[yy][xx] = "#";
    }
  }
  return grid.map((r) => r.join(""));
}

async function readGenesisArt(id: string): Promise<FriendArt> {
  let image: string | undefined;
  try {
    const uri = await client.readContract({ address: COLLECTIONS.Genesis, abi: ERC721, functionName: "tokenURI", args: [BigInt(id)] });
    const m = /^data:application\/json(;base64)?,(.*)$/s.exec(uri);
    if (m) image = JSON.parse(m[1] ? Buffer.from(m[2], "base64").toString("utf8") : decodeURIComponent(m[2]))?.image;
  } catch {
    // fall through to their artwork route
  }
  if (!image) {
    const res = await fetch(`${SITE}/api/protocol/nft-image?id=${id}&collection=Genesis&format=json`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(8_000) });
    if (res.ok) image = ((await res.json()) as { image?: string }).image;
  }
  if (typeof image !== "string") throw new Error(`Genesis #${id}: no artwork`);
  const svg = image.startsWith("data:image/svg+xml;base64,") ? Buffer.from(image.split(",")[1], "base64").toString("utf8") : decodeURIComponent(image.split(",")[1] ?? "");
  const rows = genesisRows(svg);
  if (!rows) throw new Error(`Genesis #${id}: artwork is not an 8x8 portrait`);
  return { kind: "genesis", id, rows };
}

async function readGenerationsArt(id: string): Promise<FriendArt> {
  const sprites = await spriteReader.read(BigInt(id));
  const clips: Record<string, string[][]> = {};
  for (const pose of ["idle", "walk"] as const) {
    for (const facing of SPRITE_FACINGS) {
      const len = sprites.clips[pose][facing]?.length || sprites.clips[pose].right.length || 1;
      clips[clipKey(pose, facing)] = Array.from({ length: len }, (_, f) => [...spriteFrame(sprites, facing, pose === "walk", f).frame.rows]);
    }
  }
  return { kind: "generations", id, family: sprites.familyName, clips };
}

/** Artwork is effectively immutable, so it is cached in storage for a week and in memory for the process. */
export async function friendArt(ref: FriendRef): Promise<FriendArt> {
  const key = `${ref.c}:${ref.id}`;
  const mem = artMemo.get(key);
  if (mem) return mem;
  const storeKey = `art/${ref.c.toLowerCase()}/${ref.id}.json`;
  const stored = await getJson<{ at: number; art: FriendArt }>(storeKey);
  if (stored && Date.now() - stored.at < ART_TTL) {
    artMemo.set(key, stored.art);
    return stored.art;
  }
  const art = ref.c === "Genesis" ? await readGenesisArt(ref.id) : await readGenerationsArt(ref.id);
  artMemo.set(key, art);
  await putJson(storeKey, { at: Date.now(), art }, 86_400).catch(() => undefined);
  return art;
}
