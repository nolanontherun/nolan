import Link from "next/link";
import { dailyBrief, weeklyBrief } from "@/lib/attention";
import { PageHeader, Section, Stat, Tabs } from "@/components/ui";
import { AttentionRow } from "@/components/AttentionRow";
import { dateLabel, moneyMap, plural } from "@/lib/format";

export const metadata = { title: "Brief" };
export default async function Brief({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "daily" } = await searchParams;
  const tabs = [{ id: "daily", label: "Today" }, { id: "weekly", label: "This week" }];
  return (
    <div>
      <PageHeader title={tab === "weekly" ? "Weekly brief" : "Daily brief"} kicker={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} sub="A summary of what your data shows. Nothing here is predicted or guessed." />
      <Tabs tabs={tabs} active={tab} base="/brief" />
      {tab === "daily" ? (() => {
        const b = dailyBrief();
        return (<>
          <div className="mb-10 grid grid-cols-2 gap-x-8 gap-y-7 sm:grid-cols-4">
            <Stat label="Needs reply" value={String(b.needsReply)} sub="emails" /><Stat label="Follow-ups" value={String(b.followups)} />
            <Stat label="Money outstanding" value={moneyMap(b.outstanding)} sub={plural(b.outstandingCount, "deal")} tone={b.outstandingCount ? "warn" : undefined} /><Stat label="Payments due in 7 days" value={moneyMap(b.paymentsDue)} />
            <Stat label="New opportunities" value={String(b.newOpportunities)} /><Stat label="Contracts waiting" value={String(b.contracts)} /><Stat label="Usage or exclusivity expiring" value={String(b.usageExpiring)} /><Stat label="Suspicious emails" value={String(b.suspicious)} sub="need review" />
          </div>
          <Section title="Today's items" aside={<Link href="/attention" className="link">Open Attention</Link>}><ul className="border-t border-line/10">{b.items.filter((i) => i.severity !== "low").slice(0, 12).map((i) => <AttentionRow key={i.key} item={i} compact />)}</ul></Section>
        </>);
      })() : (() => {
        const w = weeklyBrief();
        return (<>
          <p className="mb-6 text-[12.5px] text-mute">{dateLabel(w.from, { year: true })} to {dateLabel(w.to, { year: true })}</p>
          <div className="mb-10 grid grid-cols-2 gap-x-8 gap-y-7 sm:grid-cols-4">
            <Stat label="New leads" value={String(w.newLeads)} /><Stat label="New deals" value={String(w.newDeals)} /><Stat label="Deals won" value={String(w.won)} /><Stat label="Deals lost" value={String(w.lost)} />
            <Stat label="Revenue booked" value={moneyMap(w.booked)} /><Stat label="Revenue paid" value={moneyMap(w.paid)} /><Stat label="Unpaid items" value={String(w.outstanding)} /><Stat label="Overdue" value={String(w.overdue)} />
            <Stat label="Follow-ups missed" value={String(w.followupsMissed)} /><Stat label="Upcoming deadlines" value={String(w.deadlines)} /><Stat label="Usage expiring" value={String(w.usage)} /><Stat label="Exclusivity expiring" value={String(w.exclusivity)} />
          </div>
          <Section title="High-value opportunities">{w.highValue.length ? <ul className="border-t border-line/10">{w.highValue.map((d) => <li key={d.id} className="flex justify-between border-b border-line/[0.07] py-2.5 text-[13px]"><Link href={`/deals/${d.id}`} className="hover:text-accent">{d.name}</Link><span className="tabular-nums">{d.value}</span></li>)}</ul> : <p className="text-[13px] text-mute">No open leads of $5,000 or more.</p>}</Section>
          <Section title="Dormant relationships">{w.dormant.length ? <ul className="border-t border-line/10">{w.dormant.map((i) => <AttentionRow key={i.key} item={i} compact />)}</ul> : <p className="text-[13px] text-mute">None above your dormant threshold.</p>}</Section>
        </>);
      })()}
    </div>
  );
}
