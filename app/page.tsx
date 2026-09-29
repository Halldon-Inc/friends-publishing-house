import Link from "next/link";
import { DemoPages } from "@/components/DemoPages";
import { Shelf } from "@/components/Shelf";
import { feed } from "@/lib/db";

// Rendered per request: the shelf reads storage fresh, which a background-regenerated page cannot do.
export const dynamic = "force-dynamic";

const TICKER = ["FRIENDSDK WORLDS", "BLACK & WHITE OR FULL COLOUR", "HOLDERS CREATE", "EVERYONE READS", "REMIX ANY ISSUE", "POST TO X", "SPEED LINES INCLUDED", "YOUR FRIEND IS THE LEAD"];

export default async function Home() {
  const issues = await feed(48).catch(() => []);
  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="chip dark">RARE FRIENDS · ROBINHOOD CHAIN</span>
            <h1 className="display">
              <span className="nowrap">Your Friend.</span>{" "}
              <span className="hl nowrap">Your manga.</span>
            </h1>
            <p className="lede">Build a world, cast your Rare Friends, ink the pages, and drop the issue on X. Holders create. Anyone can read.</p>
            <div className="ctas">
              <Link href="/studio" className="btn primary big">Open the studio</Link>
              <Link href="#shelf" className="btn big">Read the shelf</Link>
            </div>
          </div>
          <DemoPages />
        </div>
      </section>

      <div className="strip" aria-hidden>
        <div className="strip-track">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
      </div>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2>How an issue gets made</h2>
          </div>
          <div className="steps">
            <div className="step">
              <div className="n">01</div>
              <h3>Sign in with your Friend</h3>
              <p>Connect a wallet that holds a Genesis or Generations Friend and sign once. Free, no transaction.</p>
            </div>
            <div className="step">
              <div className="n">02</div>
              <h3>Build a world</h3>
              <p>Start from a FriendSDK world, place props, walk your Friends in, and pick black and white or full colour.</p>
            </div>
            <div className="step">
              <div className="n">03</div>
              <h3>Ink the pages</h3>
              <p>Panel layouts, screentones, speed lines, speech bubbles, SFX and emotes. Your Friends in any pose.</p>
            </div>
            <div className="step">
              <div className="n">04</div>
              <h3>Publish and post</h3>
              <p>Every issue gets its own page with a share card. Post it to X, send it to Farcaster, embed it, or let others remix it.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="shelf" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <h2>Fresh off the press</h2>
            <a className="btn small" href="/feed.xml">RSS</a>
          </div>
          <Shelf issues={issues} />
        </div>
      </section>

      <footer className="footer">
        <div className="wrap">
          <span>Friends Publishing House is a community project for Rare Friends holders. Not affiliated with Rare Friends.</span>
          <span>World and character art: Rare Friends Isometric World Assets and canonical Generations sprites, via FriendSDK (Apache-2.0).</span>
        </div>
      </footer>
    </>
  );
}
