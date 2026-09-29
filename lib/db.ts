import "server-only";
import { randomBytes } from "node:crypto";
import { byline, newStory, parseStory, parseWorld, type RemixOf, type Story, type WorldDoc } from "./model";
import { deleteKeys, getJson, listKeys, putJson } from "./storage";
import { HttpError } from "./api";

/**
 * Storage layout:
 *   drafts/<owner>/<id>.json          a creator's working copy of a manga (private)
 *   worlds/<owner>/<id>.json          a creator's world (private; panels snapshot the scene they use)
 *   pub/<slug>/meta.json              a published manga: title, byline, page image URLs
 *   pub/<slug>/source.json            the story as published (what a remix starts from)
 *   pub/<slug>/v<n>/p<k>.png, card.png  rendered pages and the 1200 x 630 share card
 *   pending/<slug>.json               an in-progress publish (owner, version, page count)
 *   feed/<inverted time>-<slug>.json  newest-first index for the shelf
 */
const own = (a: string) => a.toLowerCase();

// ===== drafts =====
export async function listStories(owner: string): Promise<Story[]> {
  const keys = await listKeys(`drafts/${own(owner)}/`, 200);
  const all = await Promise.all(keys.map((k) => getJson<Story>(k.key)));
  return all.filter((s): s is Story => !!s).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getStory(owner: string, id: string): Promise<Story> {
  if (!/^[a-z0-9]{6,24}$/.test(id)) throw new HttpError(404, "No such manga.");
  const s = await getJson<Story>(`drafts/${own(owner)}/${id}.json`);
  if (!s || own(s.owner) !== own(owner)) throw new HttpError(404, "No such manga.");
  return s;
}

export async function createStory(owner: string, remixSlug?: string): Promise<Story> {
  const existing = await listKeys(`drafts/${own(owner)}/`, 201);
  if (existing.length >= 200) throw new HttpError(409, "You have 200 mangas. Delete one to start another.");
  const blank = newStory(owner);
  let story = blank;
  if (remixSlug) {
    const pub = await getPublished(remixSlug);
    const src = pub && (await getJson<Story>(`pub/${pub.slug}/source.json`));
    if (!pub || !src) throw new HttpError(404, "That manga is not published any more.");
    const remixOf: RemixOf = { slug: pub.slug, title: pub.title, by: byline(pub) };
    story = parseStory({ ...src, title: `${src.title} (Remix)`.slice(0, 80), penName: "" }, { id: blank.id, owner, createdAt: Date.now(), published: null, remixOf });
  }
  await putJson(`drafts/${own(owner)}/${story.id}.json`, story, 0);
  return story;
}

export async function saveStory(owner: string, id: string, body: unknown): Promise<Story> {
  const prev = await getStory(owner, id);
  const next = parseStory(body, { id: prev.id, owner: prev.owner, createdAt: prev.createdAt, published: prev.published, remixOf: prev.remixOf });
  await putJson(`drafts/${own(owner)}/${id}.json`, next, 0);
  return next;
}

export async function deleteStory(owner: string, id: string) {
  const s = await getStory(owner, id);
  if (s.published) await unpublish(owner, id);
  await deleteKeys([`drafts/${own(owner)}/${id}.json`]);
}

// ===== worlds =====
export async function listWorlds(owner: string): Promise<WorldDoc[]> {
  const keys = await listKeys(`worlds/${own(owner)}/`, 200);
  const all = await Promise.all(keys.map((k) => getJson<WorldDoc>(k.key)));
  return all.filter((w): w is WorldDoc => !!w).sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function getWorld(owner: string, id: string): Promise<WorldDoc> {
  if (!/^[a-z0-9]{6,24}$/.test(id)) throw new HttpError(404, "No such world.");
  const w = await getJson<WorldDoc>(`worlds/${own(owner)}/${id}.json`);
  if (!w) throw new HttpError(404, "No such world.");
  return w;
}
export async function createWorld(owner: string, body: unknown): Promise<WorldDoc> {
  const existing = await listKeys(`worlds/${own(owner)}/`, 201);
  if (existing.length >= 200) throw new HttpError(409, "You have 200 worlds. Delete one to build another.");
  const id = randomBytes(7).toString("hex");
  const w = parseWorld(body, { id, owner, createdAt: Date.now() });
  await putJson(`worlds/${own(owner)}/${id}.json`, w, 0);
  return w;
}
export async function saveWorld(owner: string, id: string, body: unknown): Promise<WorldDoc> {
  const prev = await getWorld(owner, id);
  const w = parseWorld(body, { id, owner: prev.owner, createdAt: prev.createdAt });
  await putJson(`worlds/${own(owner)}/${id}.json`, w, 0);
  return w;
}
export async function deleteWorld(owner: string, id: string) {
  await getWorld(owner, id);
  await deleteKeys([`worlds/${own(owner)}/${id}.json`]);
}

// ===== publishing =====
export type Published = {
  slug: string;
  storyId: string;
  owner: string;
  title: string;
  logline: string;
  penName: string;
  color: boolean;
  pages: string[];
  card: string;
  version: number;
  publishedAt: number;
  updatedAt: number;
  remixOf: RemixOf | null;
  feedKey: string;
};
export type FeedEntry = Pick<Published, "slug" | "owner" | "title" | "logline" | "penName" | "color" | "card" | "publishedAt" | "updatedAt" | "remixOf"> & { cover: string; pageCount: number };
type Pending = { owner: string; storyId: string; version: number; pages: number; at: number };

export const isSlug = (s: string) => /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(s);
const slugify = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "manga";

export async function getPublished(slug: string): Promise<Published | null> {
  if (!isSlug(slug)) return null;
  return getJson<Published>(`pub/${slug}/meta.json`);
}

export async function beginPublish(owner: string, storyId: string): Promise<{ slug: string; version: number; pages: number }> {
  const story = await getStory(owner, storyId);
  let slug = story.published?.slug;
  let version = 1;
  if (slug) {
    const meta = await getPublished(slug);
    version = (meta?.version ?? story.published?.version ?? 0) + 1;
  } else {
    for (let i = 0; i < 5 && !slug; i++) {
      const candidate = `${slugify(story.title)}-${randomBytes(3).toString("hex")}`;
      if (!(await getPublished(candidate)) && !(await getJson(`pending/${candidate}.json`))) slug = candidate;
    }
    if (!slug) throw new HttpError(503, "Could not reserve a link. Try again.");
  }
  const pending: Pending = { owner: own(owner), storyId, version, pages: story.pages.length, at: Date.now() };
  await putJson(`pending/${slug}.json`, pending, 0);
  return { slug, version, pages: story.pages.length };
}

async function readPending(owner: string, storyId: string, slug: string, version: number): Promise<Pending> {
  if (!isSlug(slug)) throw new HttpError(400, "Bad link.");
  const p = await getJson<Pending>(`pending/${slug}.json`);
  if (!p || p.owner !== own(owner) || p.storyId !== storyId || p.version !== version || Date.now() - p.at > 30 * 60_000) throw new HttpError(409, "This publish expired. Press Publish again.");
  return p;
}

export async function publishAssetKey(owner: string, storyId: string, slug: string, version: number, asset: string) {
  const p = await readPending(owner, storyId, slug, version);
  const m = /^p([1-9][0-9]?)$/.exec(asset);
  if (asset !== "card" && !(m && Number(m[1]) <= p.pages)) throw new HttpError(400, "Unknown page.");
  return `pub/${slug}/v${version}/${asset}.png`;
}

export async function finishPublish(owner: string, storyId: string, slug: string, version: number): Promise<Published> {
  const p = await readPending(owner, storyId, slug, version);
  const story = await getStory(owner, storyId);
  if (story.pages.length !== p.pages) throw new HttpError(409, "The manga changed while publishing. Press Publish again.");
  const files = await listKeys(`pub/${slug}/v${version}/`, 100);
  const url = (name: string) => files.find((f) => f.key === `pub/${slug}/v${version}/${name}.png`)?.url;
  const pages = Array.from({ length: p.pages }, (_, i) => url(`p${i + 1}`));
  const card = url("card");
  if (pages.some((u) => !u) || !card) throw new HttpError(409, "Some pages did not upload. Press Publish again.");

  const prev = await getPublished(slug);
  const now = Date.now();
  const inv = String(9_999_999_999_999 - now).padStart(13, "0");
  const meta: Published = {
    slug,
    storyId,
    owner: story.owner,
    title: story.title,
    logline: story.logline,
    penName: story.penName,
    color: story.color,
    pages: pages as string[],
    card,
    version,
    publishedAt: prev?.publishedAt ?? now,
    updatedAt: now,
    remixOf: story.remixOf,
    feedKey: `feed/${inv}-${slug}.json`,
  };
  await putJson(`pub/${slug}/source.json`, story);
  await putJson(`pub/${slug}/meta.json`, meta);
  const entry: FeedEntry = { slug, owner: meta.owner, title: meta.title, logline: meta.logline, penName: meta.penName, color: meta.color, card, cover: meta.pages[0], pageCount: meta.pages.length, publishedAt: meta.publishedAt, updatedAt: now, remixOf: meta.remixOf };
  await putJson(meta.feedKey, entry);
  if (prev && prev.feedKey !== meta.feedKey) await deleteKeys([prev.feedKey]);
  // Older renders are unreachable once meta points at this version.
  const old = (await listKeys(`pub/${slug}/`, 400)).filter((f) => /\/v\d+\//.test(f.key) && !f.key.startsWith(`pub/${slug}/v${version}/`));
  await deleteKeys(old.map((f) => f.key));
  await deleteKeys([`pending/${slug}.json`]);
  await putJson(`drafts/${own(owner)}/${storyId}.json`, { ...story, published: { slug, version, at: now } }, 0);
  return meta;
}

export async function unpublish(owner: string, storyId: string) {
  const story = await getStory(owner, storyId);
  const slug = story.published?.slug;
  if (!slug) return;
  const meta = await getPublished(slug);
  if (meta && own(meta.owner) !== own(owner)) throw new HttpError(403, "Not yours.");
  const files = await listKeys(`pub/${slug}/`, 400);
  await deleteKeys([...files.map((f) => f.key), ...(meta ? [meta.feedKey] : [])]);
  await putJson(`drafts/${own(owner)}/${storyId}.json`, { ...story, published: null }, 0);
}

export async function feed(limit = 60, owner?: string): Promise<FeedEntry[]> {
  const keys = await listKeys("feed/", owner ? 1000 : limit);
  const entries = await Promise.all(keys.map((k) => getJson<FeedEntry>(k.key)));
  return entries.filter((e): e is FeedEntry => !!e && (!owner || own(e.owner) === own(owner))).slice(0, limit);
}
