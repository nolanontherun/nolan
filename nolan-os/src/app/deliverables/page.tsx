import Link from "next/link";
import { all } from "@/lib/db";
import { PageHeader, Badge, Empty, Unknown } from "@/components/ui";
import { AutoSubmitSelect } from "@/components/Forms";
import { setDeliverableStatus } from "@/lib/actions";
import { DELIVERABLE_STATUS } from "@/lib/constants";
import { dateLabel, daysFromToday, relDays } from "@/lib/format";

export const metadata = { title: "Deliverables" };
export default async function Deliverables({ searchParams }: { searchParams: Promise<{ s?: string; p?: string }> }) {
  const { s, p } = await searchParams;
  let rows = all<any>("SELECT v.*, d.name dname, d.stage FROM deliverables v JOIN deals d ON d.id=v.deal_id WHERE d.archived = 0 ORDER BY COALESCE(v.deadline,'9999'), d.name");
  if (s === "open") rows = rows.filter((r) => !["Delivered", "Published"].includes(r.status));
  else if (s) rows = rows.filter((r) => r.status === s);
  if (p) rows = rows.filter((r) => (r.platform ?? "Unknown").includes(p));
  const chip = (on: boolean) => `chip ${on ? "chip-on" : ""}`;
  return (
    <div>
      <PageHeader title="Deliverables" kicker={`${rows.length} shown`} sub="Every piece of content across every deal. Structured from the original wording, which is kept on each row." />
      <div className="mb-6 flex flex-wrap gap-1.5"><Link href="/deliverables" className={chip(!s && !p)}>All</Link><Link href="/deliverables?s=open" className={chip(s === "open")}>Not yet delivered</Link>{DELIVERABLE_STATUS.map((x) => <Link key={x} href={`/deliverables?s=${x}`} className={chip(s === x)}>{x}</Link>)}{["Instagram", "TikTok", "YouTube"].map((x) => <Link key={x} href={`/deliverables?p=${x}`} className={chip(p === x)}>{x}</Link>)}</div>
      {rows.length ? <table className="tbl"><thead><tr><th>Deal</th><th>Platform</th><th>Type</th><th className="text-right">Qty</th><th>Deadline</th><th>Status</th></tr></thead><tbody>
        {rows.map((v) => <tr key={v.id}><td><Link href={`/deals/${v.deal_id}`} className="font-medium hover:text-accent">{v.dname}</Link></td><td>{v.platform ?? <Unknown text="Unknown" />}</td><td>{v.content_type ?? <Unknown text="Unknown" />}{v.notes && <div className="max-w-[300px] truncate text-[11.5px] text-faint" title={v.notes}>{v.notes}</div>}</td><td className="num">{v.quantity ?? "—"}</td><td className="whitespace-nowrap text-mute">{v.deadline ? `${dateLabel(v.deadline, { year: true })} · ${relDays(daysFromToday(v.deadline))}` : "—"}</td><td><AutoSubmitSelect action={setDeliverableStatus} name="status" value={v.status} options={DELIVERABLE_STATUS} hidden={{ id: v.id }} /></td></tr>)}
      </tbody></table> : <Empty title="No deliverables match" />}
    </div>
  );
}
