import Link from "next/link";
import { GROUPS, getAttention } from "@/lib/attention";
import { AttentionRow } from "@/components/AttentionRow";
import { PageHeader, Section, Empty } from "@/components/ui";
import { resetAttentionHidden } from "@/lib/actions";
import { all } from "@/lib/db";

export const metadata = { title: "Attention" };

export default async function Attention({ searchParams }: { searchParams: Promise<{ g?: string }> }) {
  const { g } = await searchParams;
  const items = getAttention();
  const hidden = all<{ c: number }>("SELECT COUNT(*) c FROM attention_state")[0].c;
  const shown = g ? items.filter((i) => i.group === g) : items;
  return (
    <div>
      <PageHeader title="Attention" kicker="Everything that needs a decision" sub="Built only from your stored data. Mark an item handled, snooze it, or ignore it, and it stays out of the way.">
        {hidden > 0 && <form action={resetAttentionHidden}><button className="btn btn-sm">Show {hidden} hidden again</button></form>}
      </PageHeader>
      <div className="mb-8 flex flex-wrap gap-1.5">
        <Link href="/attention" className={`chip ${!g ? "chip-on" : ""}`}>All {items.length}</Link>
        {GROUPS.map((gr) => { const n = items.filter((i) => i.group === gr.id).length; return n ? <Link key={gr.id} href={`/attention?g=${gr.id}`} className={`chip ${g === gr.id ? "chip-on" : ""}`}>{gr.label} <span className="opacity-60">{n}</span></Link> : null; })}
      </div>
      {shown.length === 0 && <Empty title="Nothing needs you right now">New items appear here when an invoice is due, a follow-up date passes, a contract waits for a signature, or usage rights near their end.</Empty>}
      {GROUPS.map((gr) => {
        const list = shown.filter((i) => i.group === gr.id);
        if (!list.length) return null;
        return <Section key={gr.id} title={`${gr.label} · ${list.length}`}><ul className="border-t border-line/10">{list.map((i) => <AttentionRow key={i.key} item={i} />)}</ul></Section>;
      })}
    </div>
  );
}
