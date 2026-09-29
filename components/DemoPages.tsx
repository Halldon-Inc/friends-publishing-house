"use client";
import { PageSvg } from "./render/PageSvg";
import { useArt } from "./useArt";
import { useEffect, useState } from "react";
import { toneBg, worldBg, type FriendRef, type Page } from "@/lib/model";

const HERO: FriendRef = { c: "Generations", id: "68840" };
const RIVAL: FriendRef = { c: "Genesis", id: "259" };

const pageA: Page = {
  layout: "splash",
  gutter: "white",
  panels: [{ bg: { ...worldBg({ base: "05-tidal-islands-complete", props: [], cast: [{ friend: HERO, x: 250, y: 200, facing: "right", pose: "idle", frame: 0, scale: 5 }] }, "Tidal Islands"), zoom: 2.3, cx: 800, cy: 640, tone: "speed" } }],
  items: [
    { id: "demo0", t: "sfx", x: 400, y: 150, rot: -5, text: "ISSUE #1", size: 110, font: "dela", fill: "#000000", stroke: "#FFFFFF" },
    { id: "demo1", t: "bubble", x: 470, y: 380, rot: 0, style: "speech", text: "This island is ours now.", w: 250, fontSize: 30, tail: { x: 520, y: 680 } },
    { id: "demo8", t: "friend", x: 560, y: 820, rot: 0, panel: 0, friend: HERO, size: 280, facing: "left", pose: "idle", frame: 0, flip: false, ink: "#000000", halo: true },
    { id: "demo2", t: "sfx", x: 170, y: 1030, rot: -12, text: "DOKI DOKI", size: 84, font: "bangers", fill: "#FFFFFF", stroke: "#000000" },
  ],
};

const pageB: Page = {
  layout: "slash",
  gutter: "black",
  panels: [{ bg: toneBg("focus") }, { bg: { ...worldBg({ base: "03-crystal-mesa-complete", props: [], cast: [] }, "Crystal Steps"), zoom: 1.9, cx: 820, cy: 560, tone: "none" } }, { bg: toneBg("dots", "#F2CE68") }],
  items: [
    { id: "demo3", t: "friend", x: 400, y: 250, rot: 0, panel: 0, friend: RIVAL, size: 250, facing: "down", pose: "idle", frame: 0, flip: false, ink: "#000000", halo: true },
    { id: "demo4", t: "bubble", x: 620, y: 150, rot: 0, style: "shout", text: "WHO MINTED THIS?!", w: 190, fontSize: 28, tail: { x: 500, y: 230 } },
    { id: "demo5", t: "friend", x: 230, y: 1010, rot: 0, panel: 2, friend: HERO, size: 300, facing: "left", pose: "walk", frame: 2, flip: false, ink: "#000000", halo: true },
    { id: "demo6", t: "emote", x: 360, y: 880, rot: 12, kind: "sweat", size: 70, ink: "#000000" },
    { id: "demo7", t: "bubble", x: 560, y: 1000, rot: 0, style: "thought", text: "...me?", w: 130, fontSize: 28, tail: { x: 380, y: 980 } },
  ],
};

export function DemoPages() {
  const { art } = useArt([HERO, RIVAL]);
  // Bubble wrapping measures text with the browser's fonts, so the demo pages render after mount only.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return <div className="hero-art" aria-hidden />;
  return (
    <div className="hero-art" aria-hidden>
      <div className="sheet s1">
        <PageSvg page={pageA} color={false} art={art} uid="demoA" />
      </div>
      <div className="sheet s2">
        <PageSvg page={pageB} color art={art} uid="demoB" />
      </div>
      <div className="burst">B&amp;W OR COLOUR!</div>
    </div>
  );
}
