import Link from "next/link";
import { getAttention, upcoming, attentionCounts } from "@/lib/attention";
import { dashboard, bestValue } from "@/lib/queries";
import { dateLabel, daysFromToday, money, moneyMap, plural, relDays, today } from "@/lib/format";
import { AttentionRow } from "@/components/AttentionRow";
import { Columns } from "@/components/Charts";
import { Badge, Section, Stat } from "@/components/ui";
import { STAGE_TONE } from "@/lib/constants";
import { monthLabel } from "@/lib/format";

export const metadata = { title: "Today" };

export default function Home() {
  const att = getAttention();
  const counts = attentionCounts(att);
  const dash = dashboard();
  const up = upcoming().slice(0, 7);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const top = att.filter((i) => i.severity !== "low").slice(0, 6);
  const by: Record<string, number> = { ...counts.by, followup: att.filter((i) => i.group === "followup" && i.key !== "tasks:undated").length };
  const line = [
    Object.keys(dash.outstanding).length ? `${moneyMap(dash.outstanding)} outstanding` : null,
    by.followup ? plural(by.followup, "follow-up") : null,
    by.lead ? plural(by.lead, "new opportunity", "new opportunities") : null,
    by.payment ? plural(att.filter((i) => i.group === "payment" && i.severity !== "medium").length, "overdue invoice") : null,
    by.contract ? plural(by.contract, "contract") + " waiting" : null,
    by.suspicious ? plural(by.suspicious, "suspicious email") : null,
  ].filter(Boolean).filter((x) => !String(x).startsWith("0 "));
  const negotiating = dash.deals.filter((d) => ["Negotiating", "Proposal sent", "Contacted", "Lead"].includes(d.stage)).sort((a, b) => (bestValue(b) ?? 0) - (bestValue(a) ?? 0)).slice(0, 5);
  const recent = dash.deals.filter((d) => d.deal_date).sort((a, b) => b.deal_date!.localeCompare(a.deal_date!)).slice(0, 5);
  const eurNote = Object.keys(dash.rev.lifetime).filter((c) => c !== "USD");
  return (
    <div>
      <header className="mb-9 rise">
        <div className="caps mb-2">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
        <h1 className="serif text-[44px] leading-[1.02] sm:text-[60px]">{greet}, Nolan.</h1>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-mute">{line.length ? line.join(" · ") : "Nothing is waiting on you."}</p>
      </header>

      <div className="grid gap-x-12 gap-y-2 lg:grid-cols-[1.35fr_1fr]">
        <div>
          <Section title="What needs you today" aside={<Link href="/attention" className="link">All {counts.total} in Attention</Link>}>
            {top.length ? <ul className="border-t border-line/10">{top.map((i) => <AttentionRow key={i.key} item={i} compact />)}</ul> : <p className="border-t border-line/10 py-6 text-[13.5px] text-mute">Nothing urgent. Lower-priority items are in Attention.</p>}
          </Section>

          <Section title="Active negotiations" aside={<Link href="/deals?stage=open" className="link">Pipeline</Link>}>
            {negotiating.length ? (
              <table className="tbl"><tbody>{negotiating.map((d) => (
                <tr key={d.id}><td><Link href={`/deals/${d.id}`} className="font-medium hover:text-accent">{d.name}</Link><div className="text-[12px] text-mute">{d.agency_name ?? "Direct"}{d.next_action ? ` · ${d.next_action}` : ""}</div></td><td><Badge tone={STAGE_TONE[d.stage]}>{d.stage}</Badge></td><td className="num">{bestValue(d) === null ? <span className="italic text-faint">Not recorded</span> : money(bestValue(d), d.currency)}</td></tr>
              ))}</tbody></table>
            ) : <p className="text-[13px] text-mute">No deals are in negotiation.</p>}
          </Section>

          <Section title="Recent deals" aside={<Link href="/deals" className="link">All deals</Link>}>
            <table className="tbl"><tbody>{recent.map((d) => (
              <tr key={d.id}><td><Link href={`/deals/${d.id}`} className="font-medium hover:text-accent">{d.name}</Link></td><td className="text-mute">{dateLabel(d.deal_date, { year: true })}</td><td><Badge tone={STAGE_TONE[d.stage]}>{d.stage}</Badge></td><td className="num">{money(d.fin.gross, d.currency)}</td></tr>
            ))}</tbody></table>
          </Section>
        </div>

        <aside>
          <Section title="Money">
            <div className="grid grid-cols-2 gap-x-6 gap-y-6">
              <Stat label="This month" value={moneyMap(dash.rev.month)} sub="received" />
              <Stat label="This year" value={moneyMap(dash.rev.year)} sub="received" />
              <Stat label="Outstanding" value={moneyMap(dash.outstanding)} sub={`${plural(dash.outstandingCount, "deal")}${dash.unknownOutstanding ? `, ${dash.unknownOutstanding} with no amount` : ""}`} tone={Object.keys(dash.outstanding).length ? "warn" : undefined} />
              <Stat label="Negotiating" value={moneyMap(dash.negotiating)} sub={plural(dash.negotiatingCount, "open deal")} />
            </div>
            <Link href="/revenue" className="link mt-5 inline-block text-[12.5px]">Revenue detail</Link>
          </Section>

          <Section title="Next 30 days">
            {up.length ? <ul className="border-t border-line/10">{up.map((e, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 border-b border-line/[0.07] py-2.5 text-[13px]"><Link href={e.href} className="min-w-0 truncate hover:text-accent">{e.label}</Link><span className="shrink-0 text-[11.5px] text-mute">{e.kind} · {relDays(daysFromToday(e.date))}</span></li>
            ))}</ul> : <p className="border-t border-line/10 pt-3 text-[13px] text-mute">No dated deadlines. Add deadlines on deliverables and follow-ups to see them here.</p>}
          </Section>

          <Section title="Received, last 12 months" aside="USD">
            <Columns data={dash.series} label={(k) => monthLabel(k).slice(0, 3)} highlight={today().slice(0, 7)} />
            {eurNote.length > 0 && <p className="mt-3 text-[11.5px] text-faint">Other currencies are never converted. Lifetime also holds {eurNote.map((c) => money(dash.rev.lifetime[c], c)).join(", ")}.</p>}
          </Section>
        </aside>
      </div>
    </div>
  );
}
