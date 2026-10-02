import Link from "next/link";
import { all, get } from "@/lib/db";
import { PageHeader, Section, Tabs, Badge, Empty } from "@/components/ui";
import { ActionForm } from "@/components/Forms";
import { analyzeEmail, confirmExtraction, markCommHandled, reviewAction, setCommClass } from "@/lib/actions";
import { classifyEmail } from "@/lib/intel";
import { dateLabel, money } from "@/lib/format";
import { EMAIL_CLASSES, PRIORITIES } from "@/lib/constants";

export const metadata = { title: "Inbox intelligence" };
const CERT = { FACT: "good", INFERENCE: "warn", UNKNOWN: "mute" } as const;

export default async function Inbox({ searchParams }: { searchParams: Promise<{ tab?: string; c?: string; q?: string; k?: string }> }) {
  const { tab = "review", c, q, k } = await searchParams;
  const queue = all<any>("SELECT * FROM review_queue WHERE status='needs_review' ORDER BY received DESC");
  const sus = all<any>("SELECT * FROM communications WHERE classification='Suspicious' AND handled=0 ORDER BY date DESC");
  let comms = all<any>("SELECT * FROM communications WHERE classification IS NULL OR classification NOT IN ('Newsletter') ORDER BY COALESCE(date,'0000') DESC LIMIT 300");
  if (k) comms = comms.filter((x) => x.classification === k);
  if (q) comms = comms.filter((x) => [x.subject, x.snippet, x.sender, x.company_name].join(" ").toLowerCase().includes(q.toLowerCase()));
  const tabs = [{ id: "review", label: "Needs review", count: queue.length }, { id: "suspicious", label: "Suspicious", count: sus.length }, { id: "emails", label: "All emails", count: comms.length }, { id: "analyze", label: "Analyse an email" }];
  const sel = c ? get<any>("SELECT * FROM communications WHERE id = ?", c) : null;
  const ex = sel?.extracted ? JSON.parse(sel.extracted) : null;
  const cls = sel?.body ? classifyEmail({ from: sel.sender ?? "", subject: sel.subject ?? "", body: sel.body }) : null;
  return (
    <div>
      <PageHeader title="Inbox intelligence" kicker="Business signals from email" sub="Emails are read by local rules, not sent to any service. The tool proposes; you confirm. Nothing it extracts becomes a confirmed deal, amount or payment on its own." />
      <Tabs tabs={tabs} active={tab} base="/inbox" />

      {tab === "review" && (queue.length ? <ul className="space-y-6">{queue.map((r) => {
        const dels: string[] = r.deliverables ? JSON.parse(r.deliverables) : [];
        const B = ({ act, children }: { act: string; children: React.ReactNode }) => <form action={reviewAction} className="inline"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="act" value={act} /><button className={`btn btn-sm ${act === "convert" ? "btn-primary" : ""}`}>{children}</button></form>;
        return (
          <li key={r.id} className="border-t border-line/10 pt-4"><div className="flex flex-wrap items-baseline justify-between gap-3"><div><div className="caps mb-1 text-warn">New potential client · needs review</div><h3 className="serif text-[26px] leading-tight">{r.company_name ?? "Company not identified"}</h3></div><Badge tone={r.confidence === "high" ? "good" : "warn"}>Confidence {r.confidence}</Badge></div>
            <p className="mt-1 text-[13px] text-mute">{r.contact_name ?? "Unnamed sender"} · {r.contact_email} · received {r.received ? dateLabel(r.received, { year: true }) : "date unknown"}</p>
            <p className="mt-2 text-[13.5px]">{r.summary}</p>
            <dl className="mt-3 grid gap-x-10 text-[13px] sm:grid-cols-3"><div><dt className="caps">Potential budget</dt><dd>{r.potential_budget ? <>{money(r.potential_budget, r.budget_currency ?? "USD")} <Badge tone="warn">{r.budget_status ?? "unconfirmed"}</Badge></> : <span className="italic text-faint">None stated</span>}</dd></div><div className="sm:col-span-2"><dt className="caps">Possible deliverables</dt><dd>{dels.length ? dels.join(" · ") : <span className="italic text-faint">None stated</span>}</dd></div></dl>
            <div className="mt-3 flex flex-wrap gap-1.5"><B act="convert">Convert to deal</B><B act="contact">Create contact</B><B act="company">Create company</B><B act="followup">Create follow-up</B><B act="ignore">Ignore</B><B act="spam">Mark spam</B><B act="suspicious">Mark suspicious</B>{r.source_communication_id && <Link href={`/inbox?tab=analyze&c=${r.source_communication_id}`} className="btn btn-sm btn-ghost">Open email</Link>}</div>
          </li>);
      })}</ul> : <Empty title="Nothing to review" action={<Link href="/inbox?tab=analyze" className="btn">Analyse an email</Link>}>When an email looks like a real opportunity it lands here instead of being forgotten. Paste an email, or import a batch in Data, to try it.</Empty>)}

      {tab === "suspicious" && (sus.length ? <ul className="space-y-5">{sus.map((m) => <li key={m.id} className="border-t border-line/10 pt-4"><div className="caps mb-1">Possibly suspicious</div><h3 className="text-[15px] font-medium">{m.subject}</h3><p className="text-[12.5px] text-mute">{m.sender} · {m.date ? dateLabel(m.date, { year: true }) : ""}</p><ul className="mt-2 list-disc pl-5 text-[13px]">{JSON.parse(m.suspicious_reasons ?? "[]").map((r: string) => <li key={r}>{r}</li>)}</ul><p className="mt-2 text-[12px] text-faint">Flagged from the wording and sender only. It is not confirmed as a scam.</p><div className="mt-2 flex gap-1.5"><form action={markCommHandled}><input type="hidden" name="id" value={m.id} /><button className="btn btn-sm">Reviewed, looks fine</button></form></div></li>)}</ul> : <Empty title="No suspicious emails">Flags come from signals such as mismatched sender domains, gift cards, crypto, upfront fees, or requests to install software.</Empty>)}

      {tab === "emails" && (<>
        <form className="mb-4 flex gap-2" action="/inbox"><input type="hidden" name="tab" value="emails" /><input name="q" defaultValue={q} placeholder="Search emails" className="input max-w-sm" /><select name="k" defaultValue={k ?? ""} className="input !w-44"><option value="">All classes</option>{EMAIL_CLASSES.map((x) => <option key={x}>{x}</option>)}</select><button className="btn">Filter</button></form>
        {comms.length ? <table className="tbl"><thead><tr><th>Date</th><th>Email</th><th>Class</th><th>Priority</th></tr></thead><tbody>{comms.map((m) => <tr key={m.id}><td className="whitespace-nowrap text-mute">{m.date ? dateLabel(m.date.slice(0, 10), { year: true }) : "Draft"}</td><td className="max-w-[420px]"><Link href={`/inbox?tab=analyze&c=${m.id}`} className="font-medium hover:text-accent">{m.subject}</Link><div className="truncate text-[12px] text-mute">{m.direction === "in" ? "From" : m.direction === "draft" ? "Draft to" : "To"} {m.direction === "in" ? m.sender : m.recipient}{m.deal_id ? "" : ""}</div></td>
          <td colSpan={2}><form action={setCommClass} className="flex gap-1.5"><input type="hidden" name="id" value={m.id} /><select name="classification" defaultValue={m.classification ?? ""} className="input !w-auto !py-1"><option value="">Unclassified</option>{EMAIL_CLASSES.map((x) => <option key={x}>{x}</option>)}</select><select name="priority" defaultValue={m.priority ?? ""} className="input !w-auto !py-1"><option value="">—</option>{PRIORITIES.map((x) => <option key={x}>{x}</option>)}</select><button className="btn btn-ghost btn-sm">Save</button></form></td></tr>)}</tbody></table> : <Empty title="No emails imported yet">Use Data to import emails as CSV or JSON, or paste one under “Analyse an email”.</Empty>}
      </>)}

      {tab === "analyze" && (
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
          <div>
            <p className="mb-4 text-[13px] text-mute">Paste an email. Nolan OS classifies it, spots offers, deliverables, usage, exclusivity, dates and payment promises, and marks each finding as <b>fact</b> (stated), <b>inference</b> (hedged) or unknown. Nothing is finalised.</p>
            <ActionForm action={analyzeEmail} submit="Analyse" className="grid gap-3">
              <label><span className="label">From</span><input name="from" className="input" placeholder="Name <name@brand.com>" /></label>
              <label><span className="label">Company they claim to represent (optional)</span><input name="company" className="input" /></label>
              <label><span className="label">Subject</span><input name="subject" className="input" /></label>
              <label><span className="label">Email text</span><textarea name="body" required rows={10} className="input" placeholder="Would love to offer $5,000 for one Instagram Reel, 30 days paid usage…" /></label>
            </ActionForm>
          </div>
          <div>
            {sel && ex ? (<>
              <div className="caps mb-1">{ex.facts.length ? `AI detected ${ex.facts.length} deal detail${ex.facts.length === 1 ? "" : "s"}` : "No deal details detected"}</div>
              <h3 className="serif text-[26px] leading-tight">{sel.subject}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2"><Badge tone={sel.classification === "Suspicious" ? "bad" : "accent"}>{sel.classification}</Badge><Badge>{sel.priority} priority</Badge><Badge tone={sel.extraction_status === "Confirmed" ? "good" : "warn"}>{sel.extraction_status}</Badge></div>
              {cls && cls.signals.length > 0 && <ul className="mt-3 list-disc pl-5 text-[12.5px] text-mute">{cls.signals.map((s) => <li key={s}>{s}</li>)}</ul>}
              {sel.suspicious_reasons && <div className="mt-3 rounded-[5px] border border-warn/40 bg-warn/10 px-3 py-2 text-[12.5px]"><b className="text-warn">Possibly suspicious</b><ul className="mt-1 list-disc pl-5">{JSON.parse(sel.suspicious_reasons).map((r: string) => <li key={r}>{r}</li>)}</ul><span className="text-faint">Warning signals only, not a verdict.</span></div>}
              {ex.facts.length > 0 && <table className="tbl mt-4"><thead><tr><th>Detail</th><th>Value</th><th>Certainty</th></tr></thead><tbody>{ex.facts.map((f: any, i: number) => <tr key={i}><td>{f.label}</td><td><b>{f.key === "offer" ? money(f.amount, f.currency) : f.value}</b><div className="max-w-[300px] text-[11.5px] italic text-faint">“{f.evidence.slice(0, 140)}”</div></td><td><Badge tone={(CERT as any)[f.certainty]}>{f.certainty.toLowerCase()}</Badge></td></tr>)}</tbody></table>}
              {ex.promise && <p className="mt-4 rounded-[5px] border border-warn/30 bg-warn/[0.07] px-3 py-2 text-[12.5px]"><b>Payment promise detected.</b> “{ex.promise.text}” {ex.promise.claimed ? `Claimed timing: ${ex.promise.claimed}.` : ""} A promise is not a payment; the invoice stays unpaid until you confirm.</p>}
              <div className="mt-4 flex flex-wrap gap-1.5">{sel.extraction_status !== "Confirmed" && <form action={confirmExtraction}><input type="hidden" name="id" value={sel.id} /><button className="btn btn-sm">I have checked these details</button></form>}<Link href="/inbox?tab=review" className="btn btn-sm btn-ghost">Go to review queue</Link></div>
            </>) : <Empty title="Results appear here">After you analyse an email you see what was found and how certain each detail is.</Empty>}
          </div>
        </div>
      )}
    </div>
  );
}
