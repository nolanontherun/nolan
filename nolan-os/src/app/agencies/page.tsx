import Link from "next/link";
import { agencyRows } from "@/lib/queries";
import { Empty, PageHeader } from "@/components/ui";
import { dateLabel, moneyMap } from "@/lib/format";
import { createAgency } from "@/lib/actions";
import { ActionForm } from "@/components/Forms";

export const metadata = { title: "Agencies" };
export default function Agencies() {
  const rows = agencyRows().sort((a, b) => b.dealCount - a.dealCount);
  return (
    <div>
      <PageHeader title="Agencies" kicker={`${rows.length} on record`} sub="Intermediaries between you and the brand. Each profile shows its contacts, the clients it brought, campaigns and revenue." />
      {rows.length ? <table className="tbl"><thead><tr><th>Agency</th><th className="text-right">Deals</th><th className="text-right">Clients</th><th className="text-right">Contacts</th><th className="text-right">Received</th><th>Last deal</th></tr></thead><tbody>
        {rows.map((a) => <tr key={a.id}><td><Link href={`/agencies/${a.id}`} className="font-medium hover:text-accent">{a.name}</Link></td><td className="num">{a.dealCount}</td><td className="num">{a.clients.length}</td><td className="num">{a.contact_count}</td><td className="num">{Object.keys(a.lifetime).length ? moneyMap(a.lifetime) : "—"}</td><td className="text-mute">{a.last ? dateLabel(a.last, { year: true }) : "—"}</td></tr>)}
      </tbody></table> : <Empty title="No agencies yet" />}
      <details className="mt-10 no-print"><summary className="btn btn-sm cursor-pointer list-none">New agency</summary><ActionForm action={createAgency} submit="Create" className="mt-3 max-w-xl"><div className="grid gap-3 sm:grid-cols-2"><label><span className="label">Name</span><input name="name" required className="input" /></label><label><span className="label">Website</span><input name="website" className="input" /></label><label><span className="label">Location</span><input name="location" className="input" /></label><label><span className="label">Specialty</span><input name="specialty" className="input" /></label></div></ActionForm></details>
    </div>
  );
}
