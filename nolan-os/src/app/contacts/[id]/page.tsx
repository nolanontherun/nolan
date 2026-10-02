import Link from "next/link";
import { notFound } from "next/navigation";
import { contactRows } from "@/lib/queries";
import { all } from "@/lib/db";
import { dateLabel, daysBetween, moneyMap, today, money } from "@/lib/format";
import { Empty, KV, Section, Source, Unknown } from "@/components/ui";
import { DealTable } from "@/components/DealTable";
import { CONTACT_TYPES, DEFAULT_TAGS } from "@/lib/constants";
import { addNote, toggleTag, updateContact } from "@/lib/actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return { title: contactRows().find((c) => c.id === id)?.full_name ?? "Contact" }; }

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = contactRows().find((x) => x.id === id);
  if (!c) notFound();
  const notes = all<any>("SELECT * FROM notes WHERE entity='contact' AND entity_id = ? ORDER BY created_at DESC", id);
  const comms = c.email ? all<any>("SELECT * FROM communications WHERE LOWER(sender) LIKE ? OR LOWER(recipient) LIKE ? ORDER BY date DESC", `%${c.email.toLowerCase()}%`, `%${c.email.toLowerCase()}%`) : [];
  const t = today();
  const last = c.last_contact_effective;
  const F = ({ k, l }: { k: string; l: string }) => <label><span className="label">{l}</span><input name={k} defaultValue={(c as any)[k] ?? ""} className="input" /></label>;
  return (
    <div>
      <header className="mb-8 border-b border-line/10 pb-6 rise">
        <div className="caps mb-2">{[c.job_title, c.contact_type].filter(Boolean).join(" · ") || "Contact"}</div>
        <h1 className="serif text-[44px] leading-[1.02] sm:text-[56px]">{c.full_name}</h1>
        <p className="mt-3 text-[14px] text-mute">{c.company_id ? <Link href={`/companies/${c.company_id}`} className="link">{c.company_name}</Link> : null}{c.company_id && c.agency_id ? " · " : ""}{c.agency_id ? <Link href={`/agencies/${c.agency_id}`} className="link">{c.agency_name}</Link> : null}{!c.company_id && !c.agency_id ? "Company not recorded" : ""}</p>
        <div className="mt-4 flex flex-wrap items-center gap-1.5 no-print">
          {c.tags.map((tg) => <form key={tg} action={toggleTag}><input type="hidden" name="entity" value="contact" /><input type="hidden" name="id" value={id} /><input type="hidden" name="tag" value={tg} /><button className="chip chip-on">{tg} ×</button></form>)}
          <details className="relative"><summary className="chip cursor-pointer list-none">+ tag</summary><form action={toggleTag} className="absolute z-10 mt-1 w-56 rounded-[6px] border border-line/15 bg-raised p-2 shadow-lg"><input type="hidden" name="entity" value="contact" /><input type="hidden" name="id" value={id} /><input list="ct" name="tag" className="input" /><datalist id="ct">{DEFAULT_TAGS.map((x) => <option key={x} value={x} />)}</datalist><button className="btn btn-sm mt-2 w-full">Add</button></form></details>
        </div>
      </header>
      <div className="grid gap-x-12 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <Section title="Relationship, from your data only">
            <div className="grid grid-cols-2 gap-x-10 gap-y-5 sm:grid-cols-4">
              {[["Deals", String(c.dealCount)], ["Revenue generated", Object.keys(c.lifetime).length ? moneyMap(c.lifetime) : "None recorded"], ["Last deal", c.lastDeal ? dateLabel(c.lastDeal, { year: true }) : "Not recorded"], ["Days since last contact", last ? String(daysBetween(last.slice(0, 10), t)) : "No contact recorded"]].map(([k, v]) => <div key={k}><div className="caps">{k}</div><div className="mt-1 text-[16px] font-medium">{v}</div></div>)}
            </div>
          </Section>
          <Section title="Deals">{c.deals.length ? <DealTable deals={c.deals} /> : <Empty title="No deals linked to this person" />}</Section>
          <Section title="Emails">{comms.length ? <ul className="border-t border-line/10">{comms.map((m) => <li key={m.id} className="border-b border-line/[0.07] py-2.5 text-[13px]"><div className="flex justify-between gap-3"><span className="font-medium">{m.subject}</span><span className="shrink-0 text-[11.5px] text-mute">{m.date ? dateLabel(m.date, { year: true }) : ""}</span></div><p className="text-[12.5px] text-mute">{m.snippet}</p></li>)}</ul> : <p className="text-[13px] text-mute">No emails imported for this address.</p>}</Section>
          <Section title="Notes">{notes.map((n) => <p key={n.id} className="mb-2 border-l-2 border-line/20 pl-3 text-[13px]">{n.body}</p>)}{c.notes && <p className="mb-2 text-[13px]">{c.notes}</p>}<form action={addNote} className="mt-2 flex gap-2"><input type="hidden" name="entity" value="contact" /><input type="hidden" name="entity_id" value={id} /><input name="body" className="input" placeholder="Add a note" /><button className="btn">Save</button></form></Section>
        </div>
        <aside>
          <Section title="Details">
            <dl><KV k="Email">{c.email ?? <Unknown />}</KV><KV k="Phone">{c.phone ?? <Unknown />}</KV><KV k="LinkedIn">{c.linkedin ?? <Unknown />}</KV><KV k="Instagram">{c.instagram ?? <Unknown />}</KV><KV k="Location">{c.location ?? c.country ?? <Unknown />}</KV><KV k="Preferred contact">{c.preferred_communication ?? <Unknown />}</KV><KV k="First contact">{c.first_contact ? dateLabel(c.first_contact, { year: true }) : <Unknown />}</KV><KV k="Source"><Source s={c.source} /></KV></dl>
            {c.source_notes && <p className="mt-2 text-[12px] text-mute">{c.source_notes}</p>}
          </Section>
          <Section title="Edit">
            <form action={updateContact} className="grid gap-3"><input type="hidden" name="id" value={id} />
              <F k="full_name" l="Full name" /><F k="job_title" l="Job title" /><F k="email" l="Email" /><F k="phone" l="Phone" /><F k="linkedin" l="LinkedIn" /><F k="instagram" l="Instagram" /><F k="location" l="Location" /><F k="department" l="Department" />
              <label><span className="label">Company</span><input name="company" defaultValue={c.company_name ?? ""} className="input" /></label><label><span className="label">Agency</span><input name="agency" defaultValue={c.agency_name ?? ""} className="input" /></label>
              <label><span className="label">Type</span><select name="contact_type" defaultValue={c.contact_type ?? ""} className="input"><option value="">Not set</option>{CONTACT_TYPES.map((x) => <option key={x}>{x}</option>)}</select></label>
              <label><span className="label">Preferred communication</span><input name="preferred_communication" defaultValue={c.preferred_communication ?? ""} className="input" placeholder="Email, WhatsApp…" /></label>
              <label><span className="label">First contact</span><input type="date" name="first_contact" defaultValue={c.first_contact ?? ""} className="input" /></label><label><span className="label">Last contact</span><input type="date" name="last_contact" defaultValue={c.last_contact ?? ""} className="input" /></label>
              <button className="btn btn-primary">Save</button>
            </form>
          </Section>
        </aside>
      </div>
    </div>
  );
}
