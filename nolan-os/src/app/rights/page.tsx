import Link from "next/link";
import { all } from "@/lib/db";
import { PageHeader, Section, Badge, Empty } from "@/components/ui";
import { dateLabel, daysFromToday, money, relDays } from "@/lib/format";

export const metadata = { title: "Usage and exclusivity" };
export default function Rights() {
  const usage = all<any>("SELECT u.*, d.name dname, c.name cname FROM usage_rights u JOIN deals d ON d.id=u.deal_id LEFT JOIN companies c ON c.id=d.company_id ORDER BY COALESCE(u.end_date,'9999')");
  const excl = all<any>("SELECT x.*, d.name dname, c.name cname FROM exclusivity x JOIN deals d ON d.id=x.deal_id LEFT JOIN companies c ON c.id=d.company_id ORDER BY COALESCE(x.end_date,'9999')");
  const tag = (end: string | null) => { const n = daysFromToday(end); if (n === null) return <Badge>No end date</Badge>; if (n < 0) return <Badge>Ended {-n} days ago</Badge>; if (n <= 30) return <Badge tone="warn">Ends {relDays(n)}</Badge>; return <Badge tone="good">{n} days left</Badge>; };
  return (
    <div>
      <PageHeader title="Usage and exclusivity" kicker="Rights are first-class data" sub="Open a deal to add usage terms or an exclusivity window. Warnings appear here, on Attention and on the deal." />
      <Section title={`Usage rights · ${usage.length}`}>{usage.length ? <table className="tbl"><thead><tr><th>Right</th><th>Deal</th><th>Platforms and territory</th><th>Ends</th><th className="text-right">Fee</th></tr></thead><tbody>{usage.map((u) => <tr key={u.id}><td className="font-medium">{u.kind}</td><td><Link href={`/deals/${u.deal_id}`} className="hover:text-accent">{u.dname}</Link></td><td className="text-mute">{[u.platforms, u.territory].filter(Boolean).join(" · ") || "Not recorded"}</td><td>{u.end_date ? dateLabel(u.end_date, { year: true }) : "—"} {tag(u.end_date)}</td><td className="num">{u.fee ? money(u.fee, u.currency) : "—"}</td></tr>)}</tbody></table> : <Empty title="No usage rights recorded yet">None of your imported sources listed usage terms. Add paid usage, whitelisting or licensing on a deal and expiry warnings begin.</Empty>}</Section>
      <Section title={`Exclusivity · ${excl.length}`}>{excl.length ? <table className="tbl"><thead><tr><th>Category</th><th>Deal</th><th>Competitors</th><th>Ends</th><th className="text-right">Fee</th></tr></thead><tbody>{excl.map((u) => <tr key={u.id}><td className="font-medium">{u.competitor_category ?? "Not recorded"}</td><td><Link href={`/deals/${u.deal_id}`} className="hover:text-accent">{u.dname}</Link></td><td className="text-mute">{u.competitors ?? "Not recorded"}</td><td>{u.end_date ? dateLabel(u.end_date, { year: true }) : "—"} {tag(u.end_date)}</td><td className="num">{u.fee ? money(u.fee, u.currency) : "—"}</td></tr>)}</tbody></table> : <Empty title="No exclusivity recorded yet">When you add one, creating a deal in the same category shows a warning. By default it never blocks you; change that in Settings.</Empty>}</Section>
    </div>
  );
}
