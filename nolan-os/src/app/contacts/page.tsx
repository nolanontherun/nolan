import Link from "next/link";
import { contactRows } from "@/lib/queries";
import { Empty, PageHeader, Unknown } from "@/components/ui";
import { dateLabel, daysBetween, money, moneyMap, today } from "@/lib/format";
import { createContact } from "@/lib/actions";
import { ActionForm } from "@/components/Forms";
import { CONTACT_TYPES } from "@/lib/constants";

export const metadata = { title: "Contacts" };
type SP = { q?: string; f?: string; type?: string };

export default async function Contacts({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const all = contactRows();
  let rows = all;
  const q = sp.q?.toLowerCase().trim();
  if (q) rows = rows.filter((c) => [c.full_name, c.email, c.job_title, c.company_name, c.agency_name, c.notes, c.tags.join(" ")].join(" ").toLowerCase().includes(q));
  const t = today();
  if (sp.f === "agency") rows = rows.filter((c) => c.agency_id);
  if (sp.f === "stale") rows = rows.filter((c) => c.last_contact_effective && daysBetween(c.last_contact_effective.slice(0, 10), t) >= 180);
  if (sp.f === "nodate") rows = rows.filter((c) => !c.last_contact_effective);
  if (sp.f === "big") rows = rows.filter((c) => c.maxOffer >= 1000000);
  if (sp.f === "noemail") rows = rows.filter((c) => !c.email);
  if (sp.type) rows = rows.filter((c) => c.contact_type === sp.type);
  const chip = (on: boolean) => `chip ${on ? "chip-on" : ""}`;
  return (
    <div>
      <PageHeader title="Contacts" kicker={`${all.length} people`} sub="Only people who appear in your sources. No emails, titles or phone numbers are guessed; empty fields stay empty.">
        <a href="/api/export/contacts" className="btn btn-sm">Export CSV</a>
      </PageHeader>
      <form className="mb-4 flex gap-2" action="/contacts"><input name="q" defaultValue={sp.q} placeholder="Search name, email, company, agency, note…" className="input max-w-md" /><button className="btn">Search</button></form>
      <div className="mb-6 flex flex-wrap gap-1.5">
        <Link href="/contacts" className={chip(!sp.f && !sp.type)}>Everyone</Link>
        <Link href="/contacts?f=agency" className={chip(sp.f === "agency")}>Agency contacts</Link>
        <Link href="/contacts?f=big" className={chip(sp.f === "big")}>Offered or agreed $10,000+</Link>
        <Link href="/contacts?f=stale" className={chip(sp.f === "stale")}>Not in touch for 6+ months</Link>
        <Link href="/contacts?f=nodate" className={chip(sp.f === "nodate")}>No contact date recorded</Link>
        <Link href="/contacts?f=noemail" className={chip(sp.f === "noemail")}>Missing email</Link>
        <Link href="/companies?f=repeat" className="chip">Brands worked with more than once →</Link>
      </div>
      {rows.length ? (
        <>
          <table className="tbl hidden md:table"><thead><tr><th>Name</th><th>Company or agency</th><th>Email</th><th>Last contact</th><th className="text-right">Deals</th><th className="text-right">Received</th></tr></thead><tbody>
            {rows.map((c) => <tr key={c.id}><td><Link href={`/contacts/${c.id}`} className="font-medium hover:text-accent">{c.full_name}</Link><div className="text-[12px] text-mute">{c.job_title ?? c.contact_type ?? ""}</div></td><td className="text-mute">{c.company_name ?? c.agency_name ?? "—"}</td><td className="text-mute">{c.email ?? <Unknown />}</td><td className="text-mute">{c.last_contact_effective ? dateLabel(c.last_contact_effective.slice(0, 10), { year: true }) : "—"}</td><td className="num">{c.dealCount}</td><td className="num">{Object.keys(c.lifetime).length ? moneyMap(c.lifetime) : "—"}</td></tr>)}
          </tbody></table>
          <ul className="md:hidden">{rows.map((c) => <li key={c.id} className="border-b border-line/[0.08] py-3"><Link href={`/contacts/${c.id}`}><span className="block font-medium">{c.full_name}</span><span className="text-[12px] text-mute">{c.company_name ?? c.agency_name ?? "No company"}{c.email ? ` · ${c.email}` : ""}</span></Link></li>)}</ul>
        </>
      ) : <Empty title="No contacts match" />}
      <details className="mt-10 no-print"><summary className="btn btn-sm cursor-pointer list-none">New contact</summary>
        <ActionForm action={createContact} submit="Add contact" className="mt-3 max-w-2xl"><div className="grid gap-3 sm:grid-cols-2"><label><span className="label">Full name</span><input name="full_name" required className="input" /></label><label><span className="label">Job title</span><input name="job_title" className="input" /></label><label><span className="label">Email</span><input name="email" type="email" className="input" /></label><label><span className="label">Phone</span><input name="phone" className="input" /></label><label><span className="label">Company</span><input name="company" className="input" /></label><label><span className="label">Agency</span><input name="agency" className="input" /></label><label><span className="label">Type</span><select name="contact_type" className="input"><option value="">Not set</option>{CONTACT_TYPES.map((x) => <option key={x}>{x}</option>)}</select></label></div></ActionForm></details>
    </div>
  );
}
