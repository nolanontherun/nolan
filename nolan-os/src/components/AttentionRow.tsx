import Link from "next/link";
import { attentionAction } from "@/lib/actions";
import type { AttentionItem } from "@/lib/attention";

const DOT = { critical: "bg-bad", high: "bg-bad/80", medium: "bg-warn", low: "bg-faint" } as const;

export function AttentionRow({ item, compact = false }: { item: AttentionItem; compact?: boolean }) {
  const dealId = item.href.startsWith("/deals/") ? item.href.slice(7) : "";
  const btn = (act: string, label: string, extra?: Record<string, string>) => (
    <form action={attentionAction} className="inline">
      <input type="hidden" name="key" value={item.key} /><input type="hidden" name="act" value={act} />
      {act === "task" && <><input type="hidden" name="title" value={`Follow up: ${item.title}`} /><input type="hidden" name="deal_id" value={dealId} /></>}
      {extra && Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button className="btn btn-ghost btn-sm text-mute hover:text-ink">{label}</button>
    </form>
  );
  return (
    <li className="group flex gap-3 border-b border-line/[0.07] py-3">
      <span className={`mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full ${DOT[item.severity]}`} aria-label={item.severity} />
      <div className="min-w-0 flex-1">
        <Link href={item.href} className="block text-[13.5px] font-medium leading-snug hover:text-accent">{item.title}</Link>
        <p className="mt-0.5 text-[12.5px] leading-snug text-mute">{item.detail}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-0.5 -ml-2">
          <Link href={item.href} className="btn btn-ghost btn-sm !text-accent">Open</Link>
          {item.actions.includes("handled") && btn("handled", "Mark handled")}
          {item.actions.includes("snooze") && btn("snooze", "Snooze 3 days", { days: "3" })}
          {!compact && item.actions.includes("task") && btn("task", "Create task")}
          {item.actions.includes("ignore") && btn("ignore", "Ignore")}
        </div>
      </div>
    </li>
  );
}
