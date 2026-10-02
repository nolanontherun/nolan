import Link from "next/link";
import { all } from "@/lib/db";
import { loadDeals } from "@/lib/queries";
import { PageHeader, Empty } from "@/components/ui";
import { moneyMap } from "@/lib/format";

export const metadata = { title: "Campaigns" };
export default function Campaigns() {
  const deals = loadDeals();
  const camps = all<any>("SELECT c.*, co.name company_name, a.name agency_name FROM campaigns c LEFT JOIN companies co ON co.id=c.company_id LEFT JOIN agencies a ON a.id=c.agency_id ORDER BY c.name");
  const rows = camps.map((c) => { const ds = deals.filter((d) => d.campaign_id === c.id); const rev: Record<string, number> = {}; for (const d of ds) for (const [k, v] of Object.entries(d.fin.recognized)) rev[k] = (rev[k] ?? 0) + v; return { ...c, ds, rev }; }).filter((c) => c.ds.length).sort((a, b) => (b.ds[0]?.deal_date ?? "").localeCompare(a.ds[0]?.deal_date ?? ""));
  return (
    <div>
      <PageHeader title="Campaigns" kicker={`${rows.length} campaigns`} sub="A campaign groups the deal for one brand project: a song, a product launch or a trip." />
      {rows.length ? <table className="tbl"><thead><tr><th>Campaign</th><th>Company</th><th>Via</th><th>Deals</th><th className="text-right">Received</th></tr></thead><tbody>{rows.map((c) => <tr key={c.id}><td className="font-medium">{c.name}</td><td className="text-mute"><Link href={`/companies/${c.company_id}`} className="hover:text-accent">{c.company_name}</Link></td><td className="text-mute">{c.agency_name ?? "Direct"}</td><td>{c.ds.map((d: any) => <Link key={d.id} href={`/deals/${d.id}`} className="mr-2 text-accent">{d.stage}</Link>)}</td><td className="num">{Object.keys(c.rev).length ? moneyMap(c.rev) : "—"}</td></tr>)}</tbody></table> : <Empty title="No campaigns yet">Campaigns are created from deals.</Empty>}
    </div>
  );
}
