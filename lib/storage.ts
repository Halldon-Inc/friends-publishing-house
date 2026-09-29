import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Key/value object storage. On Vercel (BLOB_READ_WRITE_TOKEN set) it is Vercel Blob; locally it is the ./.data
 * folder, served back through /api/media. Keys are slash paths like `pub/my-slug/v3/p1.png`.
 */
export type Stored = { key: string; url: string; uploadedAt: number };

const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const ROOT = path.join(process.cwd(), ".data");
const safeKey = (key: string) => {
  if (!/^[a-z0-9][a-z0-9/_.-]{0,200}$/i.test(key) || key.includes("..")) throw new Error(`bad storage key: ${key}`);
  return key;
};

export async function putObject(key: string, body: Buffer | string, contentType: string, opts: { cacheSeconds?: number } = {}): Promise<string> {
  safeKey(key);
  if (useBlob()) {
    const { put } = await import("@vercel/blob");
    const r = await put(key, body, { access: "public", contentType, addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: opts.cacheSeconds ?? 60 });
    return r.url;
  }
  const file = path.join(ROOT, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, body);
  return `/api/media/${key}`;
}

export async function getText(key: string): Promise<string | null> {
  safeKey(key);
  if (useBlob()) {
    const { head } = await import("@vercel/blob");
    try {
      const h = await head(key);
      // The CDN may hold an overwritten JSON for up to its max-age; the query asks the origin for the current copy.
      const res = await fetch(`${h.url}?t=${Date.now()}`, { cache: "no-store" });
      return res.ok ? await res.text() : null;
    } catch {
      return null;
    }
  }
  try {
    return await fs.readFile(path.join(ROOT, key), "utf8");
  } catch {
    return null;
  }
}

export async function getJson<T>(key: string): Promise<T | null> {
  const t = await getText(key);
  if (t === null) return null;
  try {
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}

export const putJson = (key: string, value: unknown, cacheSeconds = 60) => putObject(key, JSON.stringify(value), "application/json", { cacheSeconds });

export async function listKeys(prefix: string, limit = 1000): Promise<Stored[]> {
  safeKey(prefix);
  if (useBlob()) {
    const { list } = await import("@vercel/blob");
    const out: Stored[] = [];
    let cursor: string | undefined;
    do {
      const r = await list({ prefix, cursor, limit: Math.min(1000, limit - out.length) });
      for (const b of r.blobs) out.push({ key: b.pathname, url: b.url, uploadedAt: new Date(b.uploadedAt).getTime() });
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor && out.length < limit);
    return out;
  }
  const dir = path.join(ROOT, prefix);
  const base = prefix.endsWith("/") ? dir : path.dirname(dir);
  const out: Stored[] = [];
  const walk = async (d: string) => {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else {
        const key = path.relative(ROOT, full).split(path.sep).join("/");
        if (key.startsWith(prefix)) out.push({ key, url: `/api/media/${key}`, uploadedAt: (await fs.stat(full)).mtimeMs });
      }
    }
  };
  await walk(base);
  return out.sort((a, b) => a.key.localeCompare(b.key)).slice(0, limit);
}

export async function deleteKeys(keys: string[]) {
  if (!keys.length) return;
  keys.forEach(safeKey);
  if (useBlob()) {
    const { del, head } = await import("@vercel/blob");
    const urls = (await Promise.all(keys.map((k) => head(k).then((h) => h.url).catch(() => null)))).filter((u): u is string => !!u);
    if (urls.length) await del(urls);
    return;
  }
  await Promise.all(keys.map((k) => fs.rm(path.join(ROOT, k), { force: true })));
}

/** Local mode only: read a stored file for /api/media. */
export async function readLocal(key: string): Promise<Buffer | null> {
  if (useBlob()) return null;
  try {
    return await fs.readFile(path.join(ROOT, safeKey(key)));
  } catch {
    return null;
  }
}
