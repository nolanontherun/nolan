import Link from "next/link";
import { notFound } from "next/navigation";
import { getDealFull, tagsFor } from "@/lib/queries";
import { exclusivityConflicts } from "@/lib/attention";
import { profitability } from "@/lib/calc";
import { all } from "@/lib/db";
import { dateLabel, daysFromToday, money, moneyMap, relDays, NR } from "@/lib/format";
import { CONTENT_TYPES, CURRENCIES, DELIVERABLE_STATUS, DEAL_SOURCES, EXPENSE_CATEGORIES, PAYMENT_METHODS, PLATFORMS, STAGES, STAGE_TONE, USAGE_KINDS, DEFAULT_TAGS, CATEGORIES } from "@/lib/constants";
import { Badge, KV, Section, Unknown, Source, Empty } from "@/components/ui";
import { PayBadge } from "@/components/DealTable";
import { AutoSubmitSelect, ConfirmForm } from "@/components/Forms";
import { addDeliverable, addExclusivity, addExpense, addNegotiation, addNote, addPayment, addUsage, archiveDeal, setDeliverableStatus, setFollowup, setStage, toggleTag, updateDeal, addDocument } from "@/lib/actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const f = getDealFull(id);
  return { title: f?.deal.name ?? "Deal" };
}

const Add = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <details className="group mt-3 no-print"><summary className="btn btn-sm cursor-pointer list-none">{label}</summary><div className="mt-3 rounded-[6px] border border-line/10 bg-surface p-4">{children}</div></details>
);
const L = ({ l, children, c = "" }: { l: string; children: React.ReactNode; c?: string }) => <label className={`block ${c}`}><span className="label">{l}</span>{children}</label>;
const money$ = (v: number | null, cur: string) => (v === null ? <Unknown /> : money(v, cur));
const iso = (d: string | null) => (d ? d : "");

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const f = getDealFull(id);
  if (!f) notFound();
  const { deal: d } = f;
  const cur = d.currency;
  const fs = JSON.parse(d.field_status ?? "{}") as Record<string, string>;
  const orig = d.original_source ? JSON.parse(d.original_source) : {};
  const conflicts = exclusivityConflicts({ category: d.category, competitor: d.company_name, excludeDealId: d.id, start: d.campaign_date ?? d.date_agreed, end: null });
  const activeExcl = f.exclusivity.filter((x) => !x.end_date || x.end_date >= new Date().toISOString().slice(0, 10));
  const tags = tagsFor("deal", d.id);
  const allTags = all<{ name: string }>("SELECT name FROM tags ORDER BY name").map((t) => t.name);
  const paidSame = d.fin.paidSameCurrency;
  const otherPaid = Object.entries(d.fin.paid).filter(([c]) => c !== cur);
  const costRows = f.expenses.filter((e) => e.currency === cur).reduce<Record<string, number>>((m, e) => { m[e.category ?? "Other"] = (m[e.category ?? "Other"] ?? 0) + (e.amount ?? 0); return m; }, {});
  let costs = Object.entries(costRows).map(([label, amount]) => ({ label, amount }));
  let costBasis = "actual expenses";
  if (!costs.length) { costs = [["Production", d.production_budget], ["Travel", d.travel_budget], ["DP / assistant", d.crew_budget], ["Talent", d.talent_budget]].filter(([, v]) => v).map(([label, amount]) => ({ label: label as string, amount: amount as number })); costBasis = "budgeted"; }
  const profit = profitability(d.fin.gross, costs);

  // timeline
  type Ev = { date: string | null; text: string; kind: string };
  const ev: Ev[] = [];
  const push = (date: string | null, text: string, kind: string) => ev.push({ date, text, kind });
  push(d.date_received, "Received", "Deal");
  push(d.date_contacted, "Contacted", "Deal"); push(d.date_negotiated, "Negotiation started", "Deal"); push(d.date_agreed, "Terms agreed", "Deal"); push(d.contract_date, "Contract signed", "Deal");
  push(d.campaign_date, "Campaign date", "Deal"); push(d.posting_date, "Posting date", "Deal"); push(d.completion_date, "Content delivered", "Deal"); push(d.invoice_date, "Invoice sent", "Deal");
  for (const n of f.negotiation) if (n.date) push(n.date, `${n.party === "nolan" ? "You" : n.party === "brand" ? "Brand" : "Both"}: ${n.kind} ${money(n.amount, n.currency)}`, "Negotiation");
  for (const p of f.payments) push(p.date, `Payment ${p.amount === null ? "(amount not recorded)" : money(p.amount, p.currency)}${p.method ? " via " + p.method : ""}${p.verified ? "" : " (unverified)"}`, "Payment");
  for (const i of f.invoices) push(i.issue_date, `Invoice ${i.number ?? ""} ${i.amount === null ? "(amount not recorded)" : money(i.amount, i.currency)}`, "Invoice");
  for (const c of f.communications) push(c.date, `${c.direction === "in" ? "Received" : c.direction === "draft" ? "Draft" : "Sent"}: ${c.subject ?? ""}`, "Email");
  for (const u of f.usage) if (u.end_date) push(u.end_date, `${u.kind} ends`, "Usage");
  for (const x of f.exclusivity) if (x.end_date) push(x.end_date, `Exclusivity ends${x.competitor_category ? ": " + x.competitor_category : ""}`, "Exclusivity");
  for (const a of f.activity) if (a.kind !== "import") push(a.at.slice(0, 10), a.summary, "Activity");
  const dated = ev.filter((e) => e.date).sort((a, b) => a.date!.localeCompare(b.date!));
  const undated = f.activity.filter((a) => a.kind === "import").map((a) => ({ date: null, text: a.summary, kind: "Import" }));

  const status = (k: string) => {
    const s = fs[k];
    if (s === "confirmed") return <Badge tone="good">Confirmed</Badge>;
    if (s === "ai_extracted") return <Badge tone="warn">AI extracted</Badge>;
    if (s === "approximate") return <Badge tone="warn">Approximate</Badge>;
    if (s === "inferred") return <Badge tone="warn">Inferred</Badge>;
    if (s === "verified") return <Badge tone="good">Verified</Badge>;
    if (s === "imported") return <Badge>From {d.source?.includes("figma") ? "board" : "sheet"}</Badge>;
    return null;
  };

  return (
    <div>
      <header className="mb-8 border-b border-line/10 pb-6 rise">
        <div className="caps mb-2 flex flex-wrap gap-x-2">
          {d.company_id ? <Link href={`/companies/${d.company_id}`} className="hover:text-accent">{d.company_name}</Link> : <span>No company</span>}
          {d.agency_id && <><span>·</span><Link href={`/agencies/${d.agency_id}`} className="hover:text-accent">via {d.agency_name}</Link></>}
          {!d.agency_id && <><span>·</span><span>Direct</span></>}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0"><h1 className="serif text-[34px] leading-[1.05] sm:text-[46px]">{d.name}</h1></div>
          <div className="text-right">
            <div className="serif text-[40px] leading-none tabular-nums">{d.fin.gross === null ? <span className="text-[24px] italic text-faint">Amount not recorded</span> : money(d.fin.gross, cur)}</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <AutoSubmitSelect action={setStage} name="stage" value={d.stage} options={[...STAGES]} hidden={{ id: d.id }} />
          <Badge tone={STAGE_TONE[d.stage]}>{d.stage}</Badge>
          <PayBadge d={d} />
          {d.payment_state === "presumed_paid" && <span className="text-[12px] text-warn">Counted as paid without proof. Record a payment to confirm.</span>}
          <span className="ml-auto flex flex-wrap items-center gap-1.5 no-print">
            {tags.map((t) => <form key={t} action={toggleTag}><input type="hidden" name="entity" value="deal" /><input type="hidden" name="id" value={d.id} /><input type="hidden" name="tag" value={t} /><button className="chip chip-on" title="Remove tag">{t} ×</button></form>)}
            <details className="relative"><summary className="chip cursor-pointer list-none">+ tag</summary><form action={toggleTag} className="absolute right-0 z-10 mt-1 w-56 rounded-[6px] border border-line/15 bg-raised p-2 shadow-lg"><input type="hidden" name="entity" value="deal" /><input type="hidden" name="id" value={d.id} /><input list="alltags" name="tag" className="input" placeholder="Camera, Hotel, custom…" /><datalist id="alltags">{[...new Set([...DEFAULT_TAGS, ...allTags])].map((t) => <option key={t} value={t} />)}</datalist><button className="btn btn-sm mt-2 w-full">Add</button></form></details>
          </span>
        </div>
        {(conflicts.length > 0) && <div className="mt-4 space-y-1.5">{conflicts.map((c) => <p key={c.id} className="rounded-[5px] border border-warn/40 bg-warn/10 px-3 py-2 text-[12.5px] text-warn">⚠ {c.text} <Link href={`/deals/${c.deal_id}`} className="underline">Open that deal</Link>. This is a warning only, the decision is yours.</p>)}</div>}
      </header>

      {/* financial flow */}
      <Section title="Financial">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border border-line/10 bg-line/10 sm:grid-cols-5">
          {[
            ["Offer", money$(d.initial_offer, cur), "Their first number"], ["Counter", money$(d.counter_offer, cur), "Your quote or counter"], ["Final", money$(d.final_amount, cur), "Agreed fee"],
            ["Paid", paidSame || otherPaid.length ? <>{paidSame ? money(paidSame, cur) : otherPaid.length ? "" : money(0, cur)}{otherPaid.map(([c, v]) => <span key={c} className="block">{money(v, c)}</span>)}</> : d.payment_state === "presumed_paid" ? <span className="text-warn">Unconfirmed</span> : money(0, cur), d.fin.unknownAmountPayments ? `${d.fin.unknownAmountPayments} payment(s) with no amount` : "Received"],
            ["Outstanding", d.fin.outstanding ? (d.fin.outstanding.amount === null ? <Unknown /> : <span className="text-bad">{money(d.fin.outstanding.amount, d.fin.outstanding.currency)}</span>) : "—", d.fin.outstanding?.basis === "stated" ? "Stated on your board" : d.fin.outstanding?.basis === "computed" ? "Gross minus paid" : ""],
          ].map(([k, v, s]) => (
            <div key={k as string} className="bg-bg p-4"><div className="caps">{k}</div><div className="mt-1 text-[20px] font-medium tabular-nums">{v}</div><div className="mt-0.5 text-[11.5px] text-faint">{s}</div></div>
          ))}
        </div>
        {d.manual_outstanding_note && <p className="mt-2 text-[12px] text-mute">{d.manual_outstanding_note}</p>}
        <div className="mt-5 grid gap-x-12 lg:grid-cols-2">
          <dl>
            <KV k="Final amount"><span className="mr-2">{money$(d.final_amount, cur)}</span>{status("final_amount")}</KV>
            {[["Usage fee", d.usage_fee], ["Exclusivity fee", d.exclusivity_fee], ["Whitelisting fee", d.whitelisting_fee], ["Licensing fee", d.licensing_fee], ["Affiliate commission", d.affiliate_commission]].map(([k, v]) => v ? <KV key={k as string} k={k as string}>{money(v as number, cur)}</KV> : null)}
            <KV k="Total gross revenue"><b>{money$(d.fin.gross, cur)}</b></KV>
            <KV k="Product value">{d.product_value ? money(d.product_value, cur) : "Not recorded"}</KV>
            <KV k="Expenses">{d.fin.expenses ? money(d.fin.expenses, cur) : "None recorded"}</KV>
            <KV k="Net revenue">{d.fin.net === null ? <span className="text-faint">Needs expenses</span> : money(d.fin.net, cur)}</KV>
          </dl>
          <dl>
            <KV k="Currency">{cur} <span className="text-faint">· original, never converted</span></KV>
            <KV k="Payment terms">{d.payment_terms ?? "Not recorded"}</KV>
            <KV k="Invoice date">{d.invoice_date ? dateLabel(d.invoice_date, { year: true }) : "Not recorded"}</KV>
            <KV k="Payment due">{d.invoice_due ? `${dateLabel(d.invoice_due, { year: true })} (${relDays(daysFromToday(d.invoice_due))})` : "Not recorded"}</KV>
            <KV k="Last payment">{d.paid_date ? dateLabel(d.paid_date, { year: true }) : "Not recorded"}</KV>
            <KV k="Payment evidence">{d.payment_verification ? <span>{({ receipt: "Receipt in email", "receipt-inferred": "Receipt matched by amount", board: "Board marked paid", presumed: "Presumed, no proof", manual: "Confirmed by you" } as any)[d.payment_verification] ?? d.payment_verification}</span> : "None"}</KV>
            <KV k="Days outstanding">{d.days_outstanding !== null ? `${d.days_outstanding} days` : d.fin.outstanding ? "No invoice or posting date recorded" : "—"}</KV>
          </dl>
        </div>
        {profit ? (
          <div className="mt-6 rounded-[6px] border border-line/10 p-4">
            <div className="caps mb-2">Profitability <span className="normal-case tracking-normal text-faint">· {costBasis}</span></div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4"><div><div className="text-[12px] text-mute">Gross</div><div className="text-[18px] tabular-nums">{money(profit.gross, cur)}</div></div><div><div className="text-[12px] text-mute">Costs</div><div className="text-[18px] tabular-nums">{money(profit.totalCosts, cur)}</div><div className="text-[11.5px] text-faint">{profit.costs.map((c) => `${c.label} ${money(c.amount, cur)}`).join(" · ")}</div></div><div><div className="text-[12px] text-mute">Estimated profit</div><div className="text-[18px] tabular-nums">{money(profit.profit, cur)}</div></div><div><div className="text-[12px] text-mute">Margin</div><div className="text-[18px] tabular-nums">{profit.margin === null ? "—" : `${Math.round(profit.margin * 100)}%`}</div></div></div>
          </div>
        ) : <p className="mt-5 text-[12.5px] text-faint">Profit is optional. Record expenses or budgets and it appears here. Missing costs are not treated as zero.</p>}
        <Add label="Edit financials">
          <form action={updateDeal} className="grid gap-3 sm:grid-cols-3"><input type="hidden" name="id" value={d.id} />
            {([["initial_offer", "Initial offer"], ["counter_offer", "Counter offer"], ["final_amount", "Final agreed amount"], ["product_value", "Product value"], ["usage_fee", "Usage fee"], ["exclusivity_fee", "Exclusivity fee"], ["whitelisting_fee", "Whitelisting fee"], ["licensing_fee", "Licensing fee"], ["affiliate_commission", "Affiliate commission"], ["production_budget", "Production budget"], ["travel_budget", "Travel budget"], ["crew_budget", "Assistant / DP budget"], ["talent_budget", "Talent budget"]] as const).map(([k, l]) => <L key={k} l={l}><input name={k} defaultValue={(d as any)[k] === null ? "" : (d as any)[k] / 100} className="input" inputMode="decimal" placeholder="Not recorded" /></L>)}
            <L l="Currency"><select name="currency" defaultValue={cur} className="input">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></L>
            <L l="Payment terms"><input name="payment_terms" defaultValue={d.payment_terms ?? ""} className="input" placeholder="Net 30" /></L>
            <div className="flex items-end"><button className="btn btn-primary w-full">Save and mark confirmed</button></div>
          </form>
        </Add>
        <Add label="Record payment">
          <form action={addPayment} className="grid gap-3 sm:grid-cols-3"><input type="hidden" name="deal_id" value={d.id} />
            <L l="Amount"><input name="amount" required className="input" inputMode="decimal" /></L>
            <L l="Currency"><select name="currency" defaultValue={cur} className="input">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></L>
            <L l="Date received"><input type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" /></L>
            <L l="Method"><select name="method" className="input"><option value="">Not recorded</option>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select></L>
            <L l="Reference" c="sm:col-span-2"><input name="reference" className="input" placeholder="Transaction or wire reference" /></L>
            <L l="Payer"><input name="payer" className="input" /></L>
            <L l="Notes" c="sm:col-span-2"><input name="notes" className="input" /></L>
            <label className="flex items-center gap-2 text-[12.5px] text-mute sm:col-span-3"><input type="checkbox" name="settles" value="yes" /> This settles the deal in full (use when the amount differs from the agreed fee)</label>
            <div><button className="btn btn-primary">Record payment</button></div>
          </form>
        </Add>
      </Section>

      <div className="grid gap-x-12 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <Section title="Negotiation" aside={f.negotiation.some((n) => !n.confirmed) ? "Order of exchange not recorded in the source" : undefined}>
            {f.negotiation.length ? (
              <table className="tbl"><thead><tr><th>#</th><th>Who</th><th>Step</th><th className="text-right">Amount</th><th>Date</th><th>Note</th></tr></thead><tbody>
                {f.negotiation.map((n) => <tr key={n.id}><td className="text-faint">{n.seq}</td><td>{n.party === "nolan" ? "You" : n.party === "brand" ? "Brand" : n.party === "agency" ? "Agency" : "Both"}</td><td>{n.kind}</td><td className="num">{money$(n.amount, n.currency)}</td><td className="text-mute">{n.date ? dateLabel(n.date, { year: true }) : "—"}</td><td className="text-[12px] text-mute">{n.note}</td></tr>)}
              </tbody></table>
            ) : <p className="text-[13px] text-mute">No negotiation history recorded for this deal.</p>}
            <Add label="Add round"><form action={addNegotiation} className="grid gap-3 sm:grid-cols-4"><input type="hidden" name="deal_id" value={d.id} />
              <L l="Who"><select name="party" className="input"><option value="brand">Brand</option><option value="nolan">You</option><option value="agency">Agency</option></select></L>
              <L l="Step"><select name="kind" className="input"><option value="offer">Offer</option><option value="counter">Counter</option><option value="final">Final agreed</option></select></L>
              <L l="Amount"><input name="amount" className="input" inputMode="decimal" required /></L>
              <L l="Currency"><select name="currency" defaultValue={cur} className="input">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></L>
              <L l="Date"><input type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" /></L>
              <L l="Note" c="sm:col-span-2"><input name="note" className="input" /></L><div className="flex items-end"><button className="btn btn-primary w-full">Add</button></div></form></Add>
          </Section>

          <Section title="Deliverables">
            {f.deliverables.length ? (
              <table className="tbl"><thead><tr><th>Platform</th><th>Type</th><th className="text-right">Qty</th><th>Deadline</th><th>Status</th></tr></thead><tbody>
                {f.deliverables.map((v) => <tr key={v.id}><td>{v.platform ?? <Unknown text="Unknown" />}</td><td>{v.content_type ?? <Unknown text="Unknown" />}{v.url && <a href={v.url} className="link ml-2 text-[12px]" target="_blank">link</a>}{v.notes && <div className="hidden text-[11.5px] text-faint sm:block">{v.notes}</div>}</td><td className="num">{v.quantity ?? "—"}</td><td className="text-mute">{v.deadline ? dateLabel(v.deadline, { year: true }) : "—"}</td><td><AutoSubmitSelect action={setDeliverableStatus} name="status" value={v.status} options={DELIVERABLE_STATUS} hidden={{ id: v.id }} /></td></tr>)}
              </tbody></table>
            ) : <p className="text-[13px] text-mute">No deliverables recorded.</p>}
            <Add label="Add deliverable"><form action={addDeliverable} className="grid gap-3 sm:grid-cols-3"><input type="hidden" name="deal_id" value={d.id} />
              <L l="Platform"><select name="platform" className="input"><option value="">Not recorded</option>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select></L>
              <L l="Content type"><select name="content_type" className="input"><option value="">Not recorded</option>{CONTENT_TYPES.map((p) => <option key={p}>{p}</option>)}</select></L>
              <L l="Quantity"><input name="quantity" type="number" min="0" step="0.5" className="input" /></L>
              <L l="Deadline"><input type="date" name="deadline" className="input" /></L><L l="Published"><input type="date" name="published_date" className="input" /></L><L l="URL"><input name="url" className="input" /></L>
              <L l="Notes" c="sm:col-span-2"><input name="notes" className="input" /></L><div className="flex items-end"><button className="btn btn-primary w-full">Add</button></div></form></Add>
          </Section>

          <Section title="Usage rights">
            {f.usage.length ? (
              <table className="tbl"><thead><tr><th>Right</th><th>Platforms and territory</th><th>Term</th><th className="text-right">Fee</th></tr></thead><tbody>
                {f.usage.map((u) => { const n = daysFromToday(u.end_date); return <tr key={u.id}><td className="font-medium">{u.kind}{u.notes && <div className="text-[11.5px] font-normal text-faint">{u.notes}</div>}</td><td className="text-mute">{[u.platforms, u.territory].filter(Boolean).join(" · ") || "Not recorded"}</td><td>{u.start_date ? dateLabel(u.start_date, { year: true }) : "?"} → {u.end_date ? dateLabel(u.end_date, { year: true }) : "?"}{u.duration && <span className="text-mute"> ({u.duration})</span>}{n !== null && <div className="mt-0.5">{n < 0 ? <Badge tone="bad">Expired {-n} days ago</Badge> : n <= 30 ? <Badge tone="warn">Expires {relDays(n)}</Badge> : <Badge tone="good">Active, {n} days left</Badge>}</div>}</td><td className="num">{u.fee ? money(u.fee, u.currency) : "—"}</td></tr>; })}
              </tbody></table>
            ) : <p className="text-[13px] text-mute">No usage rights recorded. If this deal includes paid usage or whitelisting, add it so expiry warnings work.</p>}
            <Add label="Add usage right"><form action={addUsage} className="grid gap-3 sm:grid-cols-3"><input type="hidden" name="deal_id" value={d.id} />
              <L l="Right"><select name="kind" className="input">{USAGE_KINDS.map((k) => <option key={k}>{k}</option>)}</select></L><L l="Start"><input type="date" name="start_date" className="input" /></L><L l="End"><input type="date" name="end_date" className="input" /></L>
              <L l="Territory"><input name="territory" className="input" placeholder="Worldwide, US…" /></L><L l="Platforms"><input name="platforms" className="input" placeholder="Meta, TikTok, web…" /></L><L l="Duration"><input name="duration" className="input" placeholder="30 days" /></L>
              <L l="Fee"><input name="fee" className="input" inputMode="decimal" /></L><L l="Currency"><select name="currency" defaultValue={cur} className="input">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></L><L l="Notes"><input name="notes" className="input" /></L>
              <div><button className="btn btn-primary">Add</button></div></form></Add>
          </Section>

          <Section title="Exclusivity" aside={activeExcl.length ? <Badge tone="warn">{activeExcl.length} active</Badge> : undefined}>
            {f.exclusivity.length ? (
              <table className="tbl"><thead><tr><th>Category</th><th>Competitors</th><th>Term</th><th className="text-right">Fee</th></tr></thead><tbody>
                {f.exclusivity.map((x) => { const n = daysFromToday(x.end_date); return <tr key={x.id}><td className="font-medium">{x.competitor_category ?? "Not recorded"}</td><td className="text-mute">{x.competitors ?? "Not recorded"}</td><td>{x.start_date ? dateLabel(x.start_date, { year: true }) : "?"} → {x.end_date ? dateLabel(x.end_date, { year: true }) : "?"}{n !== null && <div className="mt-0.5">{n < 0 ? <Badge>Ended</Badge> : <Badge tone={n <= 30 ? "warn" : "good"}>Active, {n} days left</Badge>}</div>}</td><td className="num">{x.fee ? money(x.fee, x.currency) : "—"}</td></tr>; })}
              </tbody></table>
            ) : <p className="text-[13px] text-mute">No exclusivity recorded.</p>}
            <Add label="Add exclusivity"><form action={addExclusivity} className="grid gap-3 sm:grid-cols-3"><input type="hidden" name="deal_id" value={d.id} />
              <L l="Competitor category"><input name="competitor_category" className="input" placeholder="Cameras, hotels…" /></L><L l="Specific competitors" c="sm:col-span-2"><input name="competitors" className="input" placeholder="Comma separated" /></L>
              <L l="Start"><input type="date" name="start_date" className="input" /></L><L l="End"><input type="date" name="end_date" className="input" /></L><L l="Duration"><input name="duration" className="input" placeholder="90 days" /></L>
              <L l="Fee"><input name="fee" className="input" inputMode="decimal" /></L><L l="Currency"><select name="currency" defaultValue={cur} className="input">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></L><L l="Notes"><input name="notes" className="input" /></L>
              <div><button className="btn btn-primary">Add</button></div></form></Add>
          </Section>

          <Section title="Payments and invoices">
            {f.payments.length > 0 && <table className="tbl mb-5"><thead><tr><th>Date</th><th>Method</th><th>Reference</th><th className="text-right">Amount</th></tr></thead><tbody>
              {f.payments.map((p) => <tr key={p.id}><td>{p.date ? dateLabel(p.date, { year: true }) : <Unknown text="Date not recorded" />}</td><td className="text-mute">{p.method ?? "—"}{!p.verified && <div className="text-[11.5px] text-warn">Unverified</div>}</td><td className="max-w-[260px] text-[12px] text-mute">{p.reference}{p.source_notes && <div className="text-faint">{p.source_notes}</div>}</td><td className="num">{money$(p.amount, p.currency)}</td></tr>)}
            </tbody></table>}
            {f.invoices.length > 0 && <table className="tbl"><thead><tr><th>Invoice</th><th>Issued</th><th>Status</th><th className="text-right">Amount</th></tr></thead><tbody>
              {f.invoices.map((i) => <tr key={i.id}><td><Link href={`/invoices/${i.id}`} className="font-medium hover:text-accent">{i.number ?? <Unknown text="Number not recorded" />}</Link></td><td className="text-mute">{i.issue_date ? dateLabel(i.issue_date, { year: true }) : "—"}</td><td><Badge tone={i.status === "Paid" ? "good" : "mute"}>{i.status}</Badge></td><td className="num">{money$(i.amount, i.currency)}</td></tr>)}
            </tbody></table>}
            {!f.payments.length && !f.invoices.length && <p className="text-[13px] text-mute">No invoices or payments recorded.</p>}
            <div className="mt-3 flex gap-2 no-print"><Link href={`/invoices/new?deal=${d.id}`} className="btn btn-sm">Create invoice</Link></div>
          </Section>

          <Section title="Communication and notes">
            {f.promises.map((p) => <p key={p.id} className="mb-2 rounded-[5px] border border-warn/30 bg-warn/[0.07] px-3 py-2 text-[12.5px]"><b>Payment promise</b> · {dateLabel(p.date, { year: true })}{p.claimed_date ? ` · claimed ${p.claimed_date}` : ""}<br />“{p.text}”<br /><span className="text-mute">{p.note}</span></p>)}
            {f.communications.length > 0 && <ul className="mb-4 border-t border-line/10">{f.communications.map((c) => (
              <li key={c.id} className="border-b border-line/[0.07] py-2.5 text-[13px]"><div className="flex items-baseline justify-between gap-3"><span className="font-medium">{c.subject}</span><span className="shrink-0 text-[11.5px] text-mute">{c.date ? dateLabel(c.date, { year: true }) : "Draft"} · {c.direction === "in" ? "Received" : c.direction === "draft" ? "Draft from board" : "Sent"}</span></div><p className="mt-0.5 text-[12.5px] text-mute">{c.snippet}</p></li>
            ))}</ul>}
            {f.notes.map((n) => <p key={n.id} className="mb-2 border-l-2 border-line/20 pl-3 text-[13px]">{n.body}<span className="ml-2 text-[11px] text-faint">{n.created_at?.slice(0, 10)}</span></p>)}
            <form action={addNote} className="mt-3 flex gap-2 no-print"><input type="hidden" name="entity" value="deal" /><input type="hidden" name="entity_id" value={d.id} /><input name="body" className="input" placeholder="Add a note" /><button className="btn">Save</button></form>
          </Section>

          <Section title="Documents">
            {f.documents.length ? <ul className="border-t border-line/10">{f.documents.map((x) => <li key={x.id} className="flex justify-between border-b border-line/[0.07] py-2 text-[13px]"><span>{x.url ? <a href={x.url} target="_blank" className="link">{x.name}</a> : x.name}<span className="ml-2 text-mute">{x.kind}</span></span></li>)}</ul> : <p className="text-[13px] text-mute">No contracts or files linked.</p>}
            <Add label="Link a document"><form action={addDocument} className="grid gap-3 sm:grid-cols-3"><input type="hidden" name="deal_id" value={d.id} /><L l="Name"><input name="name" required className="input" /></L><L l="Type"><select name="kind" className="input">{["Contract", "Invoice", "Brief", "Usage terms", "Other"].map((k) => <option key={k}>{k}</option>)}</select></L><L l="Link (Drive, Dropbox…)"><input name="url" className="input" /></L><div><button className="btn btn-primary">Add</button></div></form></Add>
          </Section>
        </div>

        <aside>
          <Section title="Next action">
            <form action={setFollowup} className="space-y-3"><input type="hidden" name="id" value={d.id} />
              <L l="Next action"><input name="next_action" defaultValue={d.next_action ?? ""} className="input" placeholder="Follow up with Sarah on Friday" /></L>
              <div className="grid grid-cols-2 gap-3"><L l="Follow-up date"><input type="date" name="next_followup" defaultValue={iso(d.next_followup)} className="input" /></L><L l="Reminder note"><input name="reminder" defaultValue={d.reminder ?? ""} className="input" /></L></div>
              <button className="btn btn-sm">Save</button>
            </form>
            {f.tasks.length > 0 && <ul className="mt-4 border-t border-line/10">{f.tasks.map((t) => <li key={t.id} className="border-b border-line/[0.07] py-2 text-[12.5px]"><span className={t.status === "done" ? "text-faint line-through" : ""}>{t.title}</span>{t.due_date && <span className="ml-2 text-mute">{dateLabel(t.due_date, { year: true })}</span>}</li>)}</ul>}
          </Section>

          <Section title="People">
            {f.contact ? <p className="text-[13px]"><Link href={`/contacts/${f.contact.id}`} className="font-medium hover:text-accent">{f.contact.full_name}</Link><br /><span className="text-mute">{f.contact.job_title ?? "Role not recorded"}{f.contact.email ? ` · ${f.contact.email}` : " · email not recorded"}</span></p> : <p className="text-[13px] text-mute">No contact linked.</p>}
          </Section>

          <Section title="Dates and details">
            <dl>
              {[["Received", d.date_received], ["Contacted", d.date_contacted], ["Negotiated", d.date_negotiated], ["Agreed", d.date_agreed], ["Contract", d.contract_date], ["Campaign", d.campaign_date], ["Posting", d.posting_date], ["Completed", d.completion_date]].map(([k, v]) => <KV key={k as string} k={k as string}>{v ? dateLabel(v as string, { year: true }) : <span className="text-faint">Not recorded</span>}</KV>)}
              <KV k="Deal source">{d.deal_source ?? <span className="text-faint">Not recorded</span>}</KV>
              <KV k="Category">{d.category ?? <span className="text-faint">Not set</span>} {status("category")}</KV>
              <KV k="Deal type">{d.deal_type ?? "—"}</KV>
            </dl>
            <Add label="Edit dates and details"><form action={updateDeal} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="id" value={d.id} />
              <L l="Deal name" c="sm:col-span-2"><input name="name" defaultValue={d.name} className="input" /></L>
              <L l="Company"><input name="company" defaultValue={d.company_name ?? ""} className="input" /></L><L l="Agency"><input name="agency" defaultValue={d.agency_name ?? ""} className="input" /></L>
              {([["date_received", "Received"], ["date_contacted", "Contacted"], ["date_negotiated", "Negotiated"], ["date_agreed", "Agreed"], ["contract_date", "Contract"], ["campaign_date", "Campaign"], ["posting_date", "Posting"], ["completion_date", "Completed"], ["invoice_date", "Invoice sent"]] as const).map(([k, l]) => <L key={k} l={l}><input type="date" name={k} defaultValue={iso((d as any)[k])} className="input" /></L>)}
              <L l="Source"><select name="deal_source" defaultValue={d.deal_source ?? ""} className="input"><option value="">Not recorded</option>{DEAL_SOURCES.map((s) => <option key={s}>{s}</option>)}</select></L>
              <L l="Category"><select name="category" defaultValue={d.category ?? ""} className="input"><option value="">Not set</option>{CATEGORIES.map((s) => <option key={s}>{s}</option>)}</select></L>
              <div className="sm:col-span-2"><button className="btn btn-primary">Save</button></div></form></Add>
          </Section>

          <Section title="Expenses">
            {f.expenses.length ? <ul className="border-t border-line/10">{f.expenses.map((e) => <li key={e.id} className="flex justify-between border-b border-line/[0.07] py-2 text-[13px]"><span>{e.category}{e.description ? ` · ${e.description}` : ""}</span><span className="tabular-nums">{money(e.amount, e.currency)}</span></li>)}</ul> : <p className="text-[13px] text-mute">None recorded.</p>}
            <Add label="Add expense"><form action={addExpense} className="grid gap-3"><input type="hidden" name="deal_id" value={d.id} /><L l="Category"><select name="category" className="input">{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></L><div className="grid grid-cols-2 gap-3"><L l="Amount"><input name="amount" required className="input" inputMode="decimal" /></L><L l="Currency"><select name="currency" defaultValue={cur} className="input">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></L></div><L l="Description"><input name="description" className="input" /></L><button className="btn btn-primary">Add</button></form></Add>
          </Section>

          <Section title="Where this came from">
            <dl>
              <KV k="Source"><Source s={d.source} /></KV>
              {orig.sheet_row && <KV k="Spreadsheet row">{orig.sheet_row}</KV>}
              {orig.figma_nodes && <KV k="Figma stickies">{orig.figma_nodes.join(", ")}</KV>}
            </dl>
            {d.source_notes && <p className="mt-2 text-[12.5px] leading-snug text-mute">{d.source_notes}</p>}
            <details className="mt-3 text-[12px] text-mute"><summary className="cursor-pointer">Original records</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-[5px] bg-surface p-3 text-[11px] leading-snug">{JSON.stringify(orig, null, 2)}</pre></details>
          </Section>

          <Section title="Timeline">
            <ol className="border-l border-line/15 pl-4">
              {dated.map((e, i) => <li key={i} className="relative pb-3 text-[12.5px]"><span className="absolute -left-[21px] top-[6px] h-2 w-2 rounded-full bg-ink/70" /><span className="text-mute">{dateLabel(e.date, { year: true })}</span> — {e.text}</li>)}
              {undated.map((e, i) => <li key={`u${i}`} className="relative pb-3 text-[12.5px] text-faint"><span className="absolute -left-[21px] top-[6px] h-2 w-2 rounded-full bg-line/30" />Date not recorded — {e.text}</li>)}
              {!dated.length && !undated.length && <li className="text-[12.5px] text-mute">No events yet.</li>}
            </ol>
          </Section>

          <div className="no-print"><ConfirmForm action={archiveDeal} message="Archive this deal? It stays in the database and in exports, but disappears from lists."><input type="hidden" name="id" value={d.id} /><button className="btn btn-sm btn-danger">Archive deal</button></ConfirmForm></div>
        </aside>
      </div>
    </div>
  );
}
