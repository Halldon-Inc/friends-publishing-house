"use client";
import { useEffect, useState } from "react";

/**
 * X and Farcaster unfurl the link into the issue's share card, so every share carries the cover. An X intent
 * cannot attach images, which is why the link (and its card) is the thing we post.
 */
export function ShareButtons({ slug, title, compact }: { slug: string; title: string; compact?: boolean }) {
  const [copied, setCopied] = useState<string | null>(null);
  // The origin is only known in the browser; until mount, links use the path (same markup on server and client).
  const [origin, setOrigin] = useState("");
  const [nativeShare, setNativeShare] = useState(false);
  useEffect(() => {
    setOrigin(window.location.origin);
    setNativeShare("share" in navigator);
  }, []);
  const url = `${origin}/read/${slug}`;
  const text = `New manga from Friends Publishing House: "${title}" 📖 starring my Rare Friends`;
  const x = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  const fc = `https://farcaster.xyz/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(url)}`;
  const tg = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  const embed = `<iframe src="${url.replace("/read/", "/embed/")}" width="420" height="640" style="border:0" title="${title.replace(/"/g, "&quot;")}" loading="lazy"></iframe>`;
  const copy = async (what: string, v: string) => {
    try {
      await navigator.clipboard.writeText(v);
      setCopied(what);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      prompt("Copy this:", v);
    }
  };
  return (
    <div className="share">
      <a className="btn dark" href={x} target="_blank" rel="noopener noreferrer">Post to X</a>
      <a className="btn" href={fc} target="_blank" rel="noopener noreferrer">Farcaster</a>
      {!compact ? <a className="btn" href={tg} target="_blank" rel="noopener noreferrer">Telegram</a> : null}
      <button className="btn" onClick={() => void copy("link", url)}>{copied === "link" ? "Copied!" : "Copy link"}</button>
      {!compact ? <button className="btn" onClick={() => void copy("embed", embed)}>{copied === "embed" ? "Copied!" : "Embed"}</button> : null}
      {nativeShare && !compact ? <button className="btn" onClick={() => void navigator.share({ title, text, url }).catch(() => undefined)}>Share…</button> : null}
    </div>
  );
}
