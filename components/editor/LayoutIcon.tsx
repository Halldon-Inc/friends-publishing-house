import { LAYOUTS, PAGE_H, PAGE_W, type LayoutId } from "@/lib/model";

export function LayoutIcon({ id }: { id: LayoutId }) {
  return (
    <svg viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} style={{ height: 54, width: "auto" }} aria-hidden>
      <rect width={PAGE_W} height={PAGE_H} fill="#fff" />
      {LAYOUTS[id].panels.map((p, i) => (
        <polygon key={i} points={p.map((q) => q.join(",")).join(" ")} fill={i === 0 ? "#CCFF00" : "#e8e8e8"} stroke="#000" strokeWidth={26} />
      ))}
    </svg>
  );
}
