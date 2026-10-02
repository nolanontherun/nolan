import Link from "next/link";
import { notFound } from "next/navigation";
import { companyRows, contactRows, tagsFor, lastActivity } from "@/lib/queries";
import { all } from "@/lib/db";
import { dateLabel, daysBetween, daysFromToday, money, moneyMap, today, plural } from "@/lib/format";
import { Badge, Empty, KV, Section, Source, Unknown, Tabs } from "@/components/ui";
import { DealTable } from "@/components/DealTable";
import { COMPANY_SIZES, CATEGORIES, DEFAULT_TAGS } from "@/lib/constants";
import { addNote, toggleTag, updateCompany } from "@/lib/actions";
import { OPEN_STAGES } from "@/lib/constants";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return { title: companyRows().find((c) => c.id === id)?.name ?? "Company" }; }

export default async function CompanyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params; const { tab = "deals" } = await searchParams;
  const c = companyRows().find((x) => x.id === id);
  if (!c) notFound();
  const contacts = contactRows().filter((x) => x.company_id === id);
  const invoices = all<any>("SELECT * FROM invoices WHERE company_id = ? ORDER BY issue_date DESC", id);
  const notes = all<any>("SELECT * FROM notes WHERE entity='company' AND entity_id = ? ORDER BY created_at DESC", id);
  const usage = all<any>("SELECT u.*, d.name dname FROM usage_rights u JOIN deals d ON d.id=u.deal_id WHERE d.company_id = ? ORDER BY u.end_date", id);
  const excl = all<any>("SELECT x.*, d.name dname FROM exclusivity x JOIN deals d ON d.id=x.deal_id WHERE d.company_id = ? ORDER BY x.end_date", id);
  const docs = all<any>("SELECT * FROM documents WHERE company_id = ? OR deal_id IN (SELECT id FROM deals WHERE company_id = ?)", id, id);
  const comms = all<any>("SELECT * FROM communications WHERE company_id = ? OR company_name = ? ORDER BY date DESC", id, c.name);
  const dups = all<any>("SELECT * FROM duplicate_reviews WHERE status='open' AND (a_id = ? OR b_id = ?)", id, id);
  const t = today();
  const last = lastActivity(id);
  const speeds = c.deals.map((d) => { const from = d.invoice_date ?? d.posting_date; return from && d.paid_date && d.paid_date >= from ? daysBetween(from, d.paid_date) : null; }).filter((x): x is number => x !== null);
  const activeUsage = usage.filter((u) => !u.end_date || u.end_date >= t).length;
  const activeExcl = excl.filter((u) => !u.end_date || u.end_date >= t).length;
  const lastComm = c.lastComm;
  const tags = tagsFor("company", id);
  const tabs = [{ id: "deals", label: "Deals", count: c.dealCount }, { id: "contacts", label: "Contacts", count: contacts.length }, { id: "invoices", label: "Invoices", count: invoices.length }, { id: "usage", label: "Usage and exclusivity", count: usage.length + excl.length }, { id: "notes", label: "Notes", count: notes.length }, { id: "documents", label: "Documents", count: docs.length }, { id: "timeline", label: "Timeline" }, { id: "edit", label: "Edit" }];
  const size = c.size_range;
  return (
    <div>
      <header className="mb-8 border-b border-line/10 pb-6 rise">
        <div className="caps mb-2">{[c.company_type, c.category].filter(Boolean).join(" · ") || "Company"}</div>
        <h1 className="serif text-[44px] leading-[1.02] sm:text-[56px]">{c.name}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-1.5 no-print">
          {tags.map((tg) => <form key={tg} action={toggleTag}><input type="hidden" name="entity" value="company" /><input type="hidden" name="id" value={id} /><input type="hidden" name="tag" value={tg} /><button className="chip chip-on">{tg} ×</button></form>)}
          <details className="relative"><summary className="chip cursor-pointer list-none">+ tag</summary><form action={toggleTag} className="absolute z-10 mt-1 w-56 rounded-[6px] border border-line/15 bg-raised p-2 shadow-lg"><input type="hidden" name="entity" value="company" /><input type="hidden" name="id" value={id} /><input list="dt" name="tag" className="input" /><datalist id="dt">{DEFAULT_TAGS.map((x) => <option key={x} value={x} />)}</datalist><button className="btn btn-sm mt-2 w-full">Add</button></form></details>
        </div>
        {dups.length > 0 && <p className="mt-4 rounded-[5px] border border-warn/40 bg-warn/10 px-3 py-2 text-[12.5px] text-warn">Possible duplicate of {dups.map((d) => (d.a_id === id ? d.b_name : d.a_name)).join(", ")}. <Link href="/quality" className="underline">Review in Data quality</Link>.</p>}
      </header>

      <Section title="Relationship, from your data only">
        <div className="grid grid-cols-2 gap-x-10 gap-y-5 sm:grid-cols-4">
          {[
            ["Lifetime received", Object.keys(c.lifetime).length ? moneyMap(c.lifetime) : "None recorded"], ["Deals", String(c.dealCount)], ["Average deal value", c.avgDeal === null ? "Not recorded" : money(c.avgDeal, c.avgCurrency)], ["Outstanding", Object.keys(c.outstanding).length ? moneyMap(c.outstanding) : "None"],
            ["First collaboration", c.first ? dateLabel(c.first, { year: true }) : "Not recorded"], ["Last collaboration", c.last ? dateLabel(c.last, { year: true }) : "Not recorded"], ["Days since last contact", lastComm ? String(daysBetween(lastComm.slice(0, 10), t)) : "No communication recorded"], ["Avg days to payment", speeds.length ? `${Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length)} (${plural(speeds.length, "deal")})` : "Not enough dates"],
            ["Open deals", String(c.active)], ["Active usage rights", String(activeUsage)], ["Active exclusivity", String(activeExcl)], ["Last activity", last ? dateLabel(last.slice(0, 10), { year: true }) : "Not recorded"],
          ].map(([k, v]) => <div key={k}><div className="caps">{k}</div><div className="mt-1 text-[16px] font-medium tabular-nums">{v}</div></div>)}
        </div>
        <dl className="mt-6 grid gap-x-12 sm:grid-cols-2">
          <KV k="Size">{size ? <>{size} employees {c.size_source ? <span className="text-faint">· {c.size_source}{c.size_source_date ? `, ${c.size_source_date}` : ""}</span> : <Badge tone="warn">No source recorded</Badge>}</> : <Unknown />}</KV>
          <KV k="Website">{c.website ? <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" className="link">{c.website}</a> : <Unknown />}</KV>
          <KV k="Headquarters">{c.headquarters ?? c.country ?? <Unknown />}</KV>
          <KV k="Industry">{c.industry ?? c.category ?? <Unknown />}</KV>
          <KV k="Source"><Source s={c.source} /></KV>
        </dl>
      </Section>

      <Tabs tabs={tabs} active={tab} base={`/companies/${id}`} />
      {tab === "deals" && (c.deals.length ? <DealTable deals={c.deals} showCompany={false} /> : <Empty title="No deals yet" />)}
      {tab === "contacts" && (contacts.length ? <table className="tbl"><thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Last contact</th></tr></thead><tbody>{contacts.map((p) => <tr key={p.id}><td><Link href={`/contacts/${p.id}`} className="font-medium hover:text-accent">{p.full_name}</Link></td><td className="text-mute">{p.job_title ?? "Not recorded"}</td><td className="text-mute">{p.email ?? "Not recorded"}</td><td className="text-mute">{p.last_contact_effective ? dateLabel(p.last_contact_effective, { year: true }) : "—"}</td></tr>)}</tbody></table> : <Empty title="No contacts recorded">Contacts are added when you import emails or create them yourself. Names are never invented.</Empty>)}
      {tab === "invoices" && (invoices.length ? <table className="tbl"><thead><tr><th>Invoice</th><th>Issued</th><th>Status</th><th className="text-right">Amount</th></tr></thead><tbody>{invoices.map((i) => <tr key={i.id}><td><Link href={`/invoices/${i.id}`} className="font-medium hover:text-accent">{i.number ?? <Unknown text="Number not recorded" />}</Link></td><td className="text-mute">{i.issue_date ? dateLabel(i.issue_date, { year: true }) : "—"}</td><td>{i.status}</td><td className="num">{money(i.amount, i.currency)}</td></tr>)}</tbody></table> : <Empty title="No invoices" />)}
      {tab === "usage" && <div className="space-y-6">{usage.length + excl.length === 0 && <Empty title="No usage or exclusivity recorded" />}{usage.map((u) => <p key={u.id} className="text-[13px]"><b>{u.kind}</b> · <Link href={`/deals/${u.deal_id}`} className="link">{u.dname}</Link> · ends {u.end_date ? dateLabel(u.end_date, { year: true }) : "not recorded"}</p>)}{excl.map((u) => <p key={u.id} className="text-[13px]"><b>Exclusivity: {u.competitor_category}</b> · <Link href={`/deals/${u.deal_id}`} className="link">{u.dname}</Link> · ends {u.end_date ? dateLabel(u.end_date, { year: true }) : "not recorded"}</p>)}</div>}
      {tab === "notes" && <div>{notes.map((n) => <p key={n.id} className="mb-3 border-l-2 border-line/20 pl-3 text-[13px]">{n.body}<span className="ml-2 text-[11px] text-faint">{n.created_at?.slice(0, 10)}</span></p>)}{c.source_notes && <p className="mb-3 border-l-2 border-line/10 pl-3 text-[12.5px] text-mute">Import note: {c.source_notes}</p>}<form action={addNote} className="mt-3 flex gap-2"><input type="hidden" name="entity" value="company" /><input type="hidden" name="entity_id" value={id} /><input name="body" className="input" placeholder="Add a note" /><button className="btn">Save</button></form></div>}
      {tab === "documents" && (docs.length ? <ul className="border-t border-line/10">{docs.map((d) => <li key={d.id} className="border-b border-line/[0.07] py-2 text-[13px]">{d.url ? <a className="link" href={d.url} target="_blank">{d.name}</a> : d.name} <span className="text-mute">{d.kind}</span></li>)}</ul> : <Empty title="No documents linked">Link contracts from a deal page.</Empty>)}
      {tab === "timeline" && (
        <ol className="border-l border-line/15 pl-4">{[...c.deals.filter((d) => d.deal_date).map((d) => ({ date: d.deal_date!, text: `${d.name} · ${d.stage}`, href: `/deals/${d.id}` })), ...comms.filter((m) => m.date).map((m) => ({ date: m.date.slice(0, 10), text: `Email: ${m.subject}`, href: "/inbox" }))].sort((a, b) => b.date.localeCompare(a.date)).map((e, i) => <li key={i} className="relative pb-3 text-[13px]"><span className="absolute -left-[21px] top-[7px] h-2 w-2 rounded-full bg-ink/70" /><span className="text-mute">{dateLabel(e.date, { year: true })}</span> — <Link href={e.href} className="hover:text-accent">{e.text}</Link></li>)}</ol>
      )}
      {tab === "edit" && (
        <form action={updateCompany} className="grid max-w-3xl gap-3 sm:grid-cols-2"><input type="hidden" name="id" value={id} />
          {([["name", "Name"], ["company_type", "Type"], ["website", "Website"], ["industry", "Industry"], ["country", "Country"], ["city", "City"], ["headquarters", "Headquarters"], ["instagram", "Instagram"], ["tiktok", "TikTok"], ["youtube", "YouTube"], ["linkedin", "LinkedIn"]] as const).map(([k, l]) => <label key={k}><span className="label">{l}</span><input name={k} defaultValue={(c as any)[k] ?? ""} className="input" /></label>)}
          <label><span className="label">Category</span><select name="category" defaultValue={c.category ?? ""} className="input"><option value="">Not set</option>{CATEGORIES.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label><span className="label">Employee range</span><select name="size_range" defaultValue={size ?? ""} className="input"><option value="">Unknown</option>{COMPANY_SIZES.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label><span className="label">Size source</span><input name="size_source" defaultValue={c.size_source ?? ""} className="input" placeholder="LinkedIn, company site…" /></label>
          <label><span className="label">Size source date</span><input type="date" name="size_source_date" defaultValue={c.size_source_date ?? ""} className="input" /></label>
          <label><span className="label">Public or private</span><select name="is_public" defaultValue={c.is_public === null ? "" : String(c.is_public)} className="input"><option value="">Unknown</option><option value="1">Public</option><option value="0">Private</option></select></label>
          <label><span className="label">Parent company</span><input name="parent_company" defaultValue="" className="input" placeholder="Creates the parent if it does not exist" /></label>
          <label className="sm:col-span-2"><span className="label">Description</span><textarea name="description" defaultValue={c.description ?? ""} className="input" /></label>
          <label className="sm:col-span-2"><span className="label">Notes</span><textarea name="notes" defaultValue={c.notes ?? ""} className="input" /></label>
          <div><button className="btn btn-primary">Save</button></div>
        </form>
      )}
    </div>
  );
}
