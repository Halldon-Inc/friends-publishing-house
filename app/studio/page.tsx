"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Gate } from "@/components/Gate";
import { PageSvg } from "@/components/render/PageSvg";
import { worldImage } from "@/components/render/worlds";
import { useArt } from "@/components/useArt";
import { api } from "@/components/useSession";
import { storyCast, WORLD_BASES, type Story, type WorldDoc } from "@/lib/model";

type Listed = Story & { pageCount: number };

function StoryCard({ s, onDelete }: { s: Listed; onDelete(): void }) {
  const { art } = useArt(storyCast(s.pages));
  return (
    <div className="card">
      <Link href={`/studio/manga/${s.id}`} className="thumb" aria-label={`Edit ${s.title}`}>
        {s.pages[0] ? <PageSvg page={s.pages[0]} color={s.color} art={art} uid={`t${s.id}`} /> : null}
      </Link>
      <div className="body">
        <h3>{s.title}</h3>
        <div className="row" style={{ marginTop: 0 }}>
          <span className={`chip ${s.published ? "signal" : ""}`}>{s.published ? "Published" : "Draft"}</span>
          <span className="chip">{s.color ? "Colour" : "B&W"}</span>
          <span className="chip">{s.pageCount}p</span>
        </div>
        <div className="row">
          <Link href={`/studio/manga/${s.id}`} className="btn small primary">Edit</Link>
          {s.published ? <Link href={`/read/${s.published.slug}`} className="btn small">Read</Link> : null}
          <button className="btn small danger" onClick={onDelete}>Delete</button>
        </div>
      </div>
    </div>
  );
}

function WorldCard({ w, onDelete }: { w: WorldDoc; onDelete(): void }) {
  const { art } = useArt(w.scene.cast.map((c) => c.friend));
  const base = WORLD_BASES.find((b) => b.id === w.scene.base)?.name;
  return (
    <div className="card">
      <Link href={`/studio/world/${w.id}`} className="thumb wide" aria-label={`Edit ${w.name}`} style={{ background: "#fff" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={worldImage(w.scene, w.color, art)} alt="" style={{ objectFit: "cover", transform: "scale(1.7)" }} />
      </Link>
      <div className="body">
        <h3>{w.name}</h3>
        <div className="row" style={{ marginTop: 0 }}>
          <span className="chip">{base}</span>
          <span className="chip">{w.color ? "Colour" : "B&W"}</span>
        </div>
        <div className="row">
          <Link href={`/studio/world/${w.id}`} className="btn small primary">Build</Link>
          <button className="btn small danger" onClick={onDelete}>Delete</button>
        </div>
      </div>
    </div>
  );
}

function Studio() {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<"mangas" | "worlds">(params.get("tab") === "worlds" ? "worlds" : "mangas");
  const [stories, setStories] = useState<Listed[] | null>(null);
  const [worlds, setWorlds] = useState<WorldDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const remixed = useRef(false);

  const load = useCallback(() => {
    api<{ stories: Listed[] }>("/api/stories").then((j) => setStories(j.stories), (e) => setError(e.message));
    api<{ worlds: WorldDoc[] }>("/api/worlds").then((j) => setWorlds(j.worlds), (e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const create = useCallback(
    async (remixOf?: string) => {
      setBusy(true);
      try {
        const { story } = await api<{ story: Story }>("/api/stories", { method: "POST", json: remixOf ? { remixOf } : {} });
        router.push(`/studio/manga/${story.id}`);
      } catch (e) {
        setError((e as Error).message);
        setBusy(false);
      }
    },
    [router],
  );

  useEffect(() => {
    const remix = params.get("remix");
    if (remix && !remixed.current) {
      remixed.current = true;
      void create(remix);
    }
  }, [params, create]);

  const newWorld = async () => {
    setBusy(true);
    try {
      const { world } = await api<{ world: WorldDoc }>("/api/worlds", { method: "POST", json: { name: "Untitled World", color: true, scene: { base: "01-garden-oval-complete" } } });
      router.push(`/studio/world/${world.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const delStory = async (s: Listed) => {
    if (!confirm(`Delete "${s.title}"?${s.published ? " It will also be taken off the shelf." : ""}`)) return;
    await api(`/api/stories/${s.id}`, { method: "DELETE" }).catch((e) => setError(e.message));
    load();
  };
  const delWorld = async (w: WorldDoc) => {
    if (!confirm(`Delete the world "${w.name}"? Pages that already use it keep their copy.`)) return;
    await api(`/api/worlds/${w.id}`, { method: "DELETE" }).catch((e) => setError(e.message));
    load();
  };

  return (
    <div className="wrap">
      <div className="studio-head">
        <h1>Studio</h1>
        <div className="row-btns">
          <button className="btn primary big" onClick={() => void create()} disabled={busy}>+ New manga</button>
          <button className="btn big" onClick={() => void newWorld()} disabled={busy}>+ New world</button>
        </div>
      </div>
      {error ? <div className="err" role="alert">{error}</div> : null}
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "mangas"} onClick={() => setTab("mangas")}>My mangas {stories ? `(${stories.length})` : ""}</button>
        <button role="tab" aria-selected={tab === "worlds"} onClick={() => setTab("worlds")}>My worlds {worlds ? `(${worlds.length})` : ""}</button>
      </div>
      {tab === "mangas" ? (
        <div className="cards">
          <button className="card new" onClick={() => void create()} disabled={busy}>
            <span className="plus">+</span>
            New manga
          </button>
          {stories === null ? <span className="px">LOADING…</span> : stories.map((s) => <StoryCard key={s.id} s={s} onDelete={() => void delStory(s)} />)}
        </div>
      ) : (
        <div className="cards">
          <button className="card new" onClick={() => void newWorld()} disabled={busy}>
            <span className="plus">+</span>
            New world
          </button>
          {worlds === null ? <span className="px">LOADING…</span> : worlds.map((w) => <WorldCard key={w.id} w={w} onDelete={() => void delWorld(w)} />)}
        </div>
      )}
    </div>
  );
}

export default function StudioPage() {
  return (
    <Gate>
      <Suspense>
        <Studio />
      </Suspense>
    </Gate>
  );
}
