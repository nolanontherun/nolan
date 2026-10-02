import Link from "next/link";
import { all } from "@/lib/db";
import { PageHeader, Empty } from "@/components/ui";
import { addDocument } from "@/lib/actions";
import { dateLabel } from "@/lib/format";

export const metadata = { title: "Documents" };
export default function Documents() {
  const docs = all<any>("SELECT x.*, d.name dname FROM documents x LEFT JOIN deals d ON d.id=x.deal_id ORDER BY x.created_at DESC");
  const deals = all<any>("SELECT id, name FROM deals WHERE archived=0 ORDER BY name");
  return (
    <div>
      <PageHeader title="Documents" kicker="Contracts, briefs, usage terms" sub="Nolan OS stores links and metadata, not copies of your files, so nothing is locked in. Link a Drive or Dropbox file to the deal it belongs to." />
      {docs.length ? <table className="tbl"><thead><tr><th>Name</th><th>Type</th><th>Deal</th><th>Added</th></tr></thead><tbody>{docs.map((d) => <tr key={d.id}><td>{d.url ? <a href={d.url} target="_blank" className="link font-medium">{d.name}</a> : <span className="font-medium">{d.name}</span>}</td><td className="text-mute">{d.kind ?? "—"}</td><td>{d.deal_id ? <Link href={`/deals/${d.deal_id}`} className="hover:text-accent">{d.dname}</Link> : "—"}</td><td className="text-mute">{dateLabel(d.created_at?.slice(0, 10), { year: true })}</td></tr>)}</tbody></table> : <Empty title="No documents linked yet">Contracts and invoices you link appear here and on their deal.</Empty>}
      <form action={addDocument} className="mt-10 grid max-w-3xl gap-3 sm:grid-cols-2"><label><span className="label">Name</span><input name="name" required className="input" /></label><label><span className="label">Link</span><input name="url" className="input" placeholder="https://drive.google.com/…" /></label><label><span className="label">Type</span><select name="kind" className="input">{["Contract", "Invoice", "Brief", "Usage terms", "Other"].map((k) => <option key={k}>{k}</option>)}</select></label><label><span className="label">Deal</span><select name="deal_id" className="input"><option value="">None</option>{deals.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><div><button className="btn btn-primary">Add document</button></div></form>
    </div>
  );
}
