import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap">
      <div className="gate" style={{ textAlign: "center" }}>
        <div className="sfx" style={{ fontSize: 96, lineHeight: 1 }}>!?</div>
        <h1>This page was never printed.</h1>
        <p>The issue may have been unpublished, or the link is off by a letter.</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link href="/#shelf" className="btn primary">Back to the shelf</Link>
        </div>
      </div>
    </div>
  );
}
