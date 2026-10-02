import Link from "next/link";
import { notFound } from "next/navigation";
import { agencyRows, contactRows } from "@/lib/queries";
import { all } from "@/lib/db";
import { dateLabel, moneyMap } from "@/lib/format";
import { Empty, KV, Section, Source, Unknown } from "@/components/ui";
import { DealTable } from "@/components/DealTable";
import { COMPANY_SIZES } from "@/lib/constants";
import { updateAgency } from "@/lib/actions";

export default async function AgencyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = agencyRows().find((x) => x.id === id);
  if (!a) notFound();
  const contacts = contactRows().filter((c) => c.agency_id === id);
  const campaigns = all<any>("SELECT c.*, co.name company_name FROM campaigns c LEFT JOIN companies co ON co.id=c.company_id WHERE c.agency_id = ? OR c.id IN (SELECT campaign_id FROM deals WHERE agency_id = ?)", id, id);
  const last = [a.last, ...contacts.map((c) => c.last_contact_effective?.slice(0, 10))].filter(Boolean).sort().pop();
  return (
    <div>
      <header className="mb-8 border-b border-line/10 pb-6 rise"><div className="caps mb-2">Agency</div><h1 className="serif text-[44px] leading-[1.02] sm:text-[56px]">{a.name}</h1></header>
      <Section title="Overview"><div className="grid grid-cols-2 gap-x-10 gap-y-5 sm:grid-cols-4">{[["Deals", String(a.dealCount)], ["Revenue received", Object.keys(a.lifetime).length ? moneyMap(a.lifetime) : "None recorded"], ["Clients", String(a.clients.length)], ["Last contact or deal", last ? dateLabel(last, { year: true }) : "Not recorded"]].map(([k, v]) => <div key={k}><div className="caps">{k}</div><div className="mt-1 text-[16px] font-medium">{v}</div></div>)}</div>
        <dl className="mt-6 grid gap-x-12 sm:grid-cols-2"><KV k="Website">{a.website ?? <Unknown />}</KV><KV k="Location">{a.location ?? <Unknown />}</KV><KV k="Employees">{a.employees_range ?? <Unknown />}</KV><KV k="Specialty">{a.specialty ?? <Unknown />}</KV><KV k="Source"><Source s={a.source} /></KV></dl>{a.source_notes && <p className="mt-2 text-[12px] text-mute">{a.source_notes}</p>}</Section>
      <div className="grid gap-x-12 lg:grid-cols-2">
        <Section title="Contacts">{contacts.length ? <ul className="border-t border-line/10">{contacts.map((c) => <li key={c.id} className="border-b border-line/[0.07] py-2.5 text-[13px]"><Link href={`/contacts/${c.id}`} className="font-medium hover:text-accent">{c.full_name}</Link><span className="ml-2 text-mute">{c.email ?? "email not recorded"}</span></li>)}</ul> : <p className="text-[13px] text-mute">No contacts recorded.</p>}</Section>
        <Section title="Clients">{a.clients.length ? <ul className="border-t border-line/10">{a.clients.map(([cid, name]) => <li key={cid} className="border-b border-line/[0.07] py-2.5 text-[13px]"><Link href={`/companies/${cid}`} className="hover:text-accent">{name}</Link></li>)}</ul> : <p className="text-[13px] text-mute">None.</p>}</Section>
      </div>
      <Section title="Campaigns">{campaigns.length ? <ul className="border-t border-line/10">{campaigns.map((c) => <li key={c.id} className="border-b border-line/[0.07] py-2.5 text-[13px]">{c.name}<span className="ml-2 text-mute">{c.company_name}</span></li>)}</ul> : <p className="text-[13px] text-mute">None.</p>}</Section>
      <Section title="Deals">{a.deals.length ? <DealTable deals={a.deals} /> : <Empty title="No deals" />}</Section>
      <Section title="Edit"><form action={updateAgency} className="grid max-w-2xl gap-3 sm:grid-cols-2"><input type="hidden" name="id" value={id} />{([["name", "Name"], ["website", "Website"], ["location", "Location"], ["specialty", "Specialty"]] as const).map(([k, l]) => <label key={k}><span className="label">{l}</span><input name={k} defaultValue={(a as any)[k] ?? ""} className="input" /></label>)}<label><span className="label">Employees</span><select name="employees_range" defaultValue={a.employees_range ?? ""} className="input"><option value="">Unknown</option>{COMPANY_SIZES.map((x) => <option key={x}>{x}</option>)}</select></label><label className="sm:col-span-2"><span className="label">Notes</span><textarea name="notes" defaultValue={a.notes ?? ""} className="input" /></label><div><button className="btn btn-primary">Save</button></div></form></Section>
    </div>
  );
}
