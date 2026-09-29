import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Shelf } from "@/components/Shelf";
import { feed } from "@/lib/db";
import { byline, isAddress, shortAddr } from "@/lib/model";

export const revalidate = 60;
type Props = { params: Promise<{ address: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = (await params).address;
  return { title: isAddress(a) ? `Manga by ${shortAddr(a)}` : "Creator" };
}

export default async function Creator({ params }: Props) {
  const a = (await params).address;
  if (!isAddress(a)) notFound();
  const issues = await feed(200, a).catch(() => []);
  const name = issues.find((i) => i.penName)?.penName;
  return (
    <div className="wrap">
      <div className="studio-head">
        <div>
          <span className="chip">{shortAddr(a)}</span>
          <h1>{name ?? (issues[0] ? byline(issues[0]) : shortAddr(a))}</h1>
        </div>
        <span className="px">{issues.length} ISSUE{issues.length === 1 ? "" : "S"}</span>
      </div>
      <div style={{ padding: "20px 0 60px" }}>
        <Shelf issues={issues} emptyText="This creator has not published yet." />
      </div>
    </div>
  );
}
