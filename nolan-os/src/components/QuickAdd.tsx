"use client";
import { useActionState, useState } from "react";
import { Icon } from "./Icon";
import { addDeliverable, addExpense, addPayment, createCompany, createContact, createDeal, createTask } from "@/lib/actions";
import { CATEGORIES, CURRENCIES, DEAL_SOURCES, EXPENSE_CATEGORIES, PAYMENT_METHODS, PLATFORMS, CONTENT_TYPES } from "@/lib/constants";

const TABS = [
  { id: "deal", label: "New deal", key: "D" }, { id: "contact", label: "New contact", key: "C" }, { id: "company", label: "New company", key: "O" }, { id: "invoice", label: "New invoice", key: "I" },
  { id: "payment", label: "Log payment", key: "P" }, { id: "followup", label: "Add follow-up", key: "F" }, { id: "expense", label: "Add expense", key: "E" }, { id: "deliverable", label: "Add deliverable", key: "V" },
];

function Err({ s }: { s: { error?: string; warnings?: string[] } | null }) {
  if (!s) return null;
  return <>{s.warnings?.map((w) => <p key={w} className="rounded-[5px] border border-warn/40 bg-warn/10 px-3 py-2 text-[12.5px] text-warn">⚠ {w} Review it, the decision is yours.</p>)}{s.error && <p className="rounded-[5px] border border-bad/40 bg-bad/10 px-3 py-2 text-[12.5px] text-bad">{s.error}</p>}</>;
}
const F = ({ l, children, c = "" }: { l: string; children: React.ReactNode; c?: string }) => <label className={`block ${c}`}><span className="label">{l}</span>{children}</label>;
const DealPick = ({ deals, required }: { deals: { id: string; name: string }[]; required?: boolean }) => (
  <F l="Deal"><select name="deal_id" required={required} className="input"><option value="">{required ? "Choose a deal" : "No deal"}</option>{deals.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></F>
);
const Cur = () => <select name="currency" className="input"><option>USD</option>{CURRENCIES.slice(1).map((c) => <option key={c}>{c}</option>)}</select>;

export function QuickAdd({ start, deals, onClose }: { start: string; deals: { id: string; name: string }[]; onClose: () => void }) {
  const [tab, setTab] = useState(start);
  const [dealState, dealAction, dealPending] = useActionState(createDeal, null);
  const [contactState, contactAction, contactPending] = useActionState(createContact, null);
  const [companyState, companyAction, companyPending] = useActionState(createCompany, null);
  const [taskState, taskAction, taskPending] = useActionState(createTask, null);
  const done = async (fn: (fd: FormData) => Promise<void>, fd: FormData) => { await fn(fd); onClose(); };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 fade-in sm:items-center sm:p-4" onClick={onClose}>
      <div className="rise flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[14px] border border-line/15 bg-raised sm:rounded-[10px] sm:flex-row" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-1 overflow-x-auto border-b border-line/10 bg-surface p-2 sm:w-[190px] sm:shrink-0 sm:flex-col sm:border-b-0 sm:border-r sm:p-2.5">
          <div className="caps hidden px-2 py-1.5 sm:block">Quick add</div>
          {TABS.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={`flex shrink-0 items-center justify-between gap-3 rounded-[5px] px-2.5 py-1.5 text-left text-[13px] ${tab === t.id ? "bg-line/[0.08] text-ink" : "text-mute hover:text-ink"}`}>{t.label}</button>)}
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="serif text-[26px]">{TABS.find((t) => t.id === tab)?.label}</h2><button onClick={onClose} className="btn btn-ghost !px-1.5" aria-label="Close"><Icon name="close" size={16} /></button></div>

          {tab === "deal" && (
            <form action={dealAction} className="space-y-3">
              <Err s={dealState} />
              <div className="grid gap-3 sm:grid-cols-2">
                <F l="Company or brand" c="sm:col-span-2"><input name="company" required autoFocus className="input" placeholder="Sony" /></F>
                <F l="Campaign"><input name="campaign" className="input" placeholder="Alpha series launch" /></F>
                <F l="Agency"><input name="agency" className="input" placeholder="Leave empty if direct" /></F>
                <F l="Category"><select name="category" className="input"><option value="">Not set</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></F>
                <F l="Source"><select name="deal_source" className="input"><option value="">Not recorded</option>{DEAL_SOURCES.map((c) => <option key={c}>{c}</option>)}</select></F>
                <F l="Their offer"><input name="offer" className="input" inputMode="decimal" placeholder="5000 or 5k" /></F>
                <F l="Agreed amount"><input name="amount" className="input" inputMode="decimal" placeholder="Leave empty until agreed" /></F>
                <F l="Currency"><Cur /></F>
                <F l="Next follow-up"><input type="date" name="next_followup" className="input" /></F>
                <F l="Next action" c="sm:col-span-2"><input name="next_action" className="input" placeholder="Send rates" /></F>
              </div>
              <label className="flex items-center gap-2 text-[12.5px] text-mute"><input type="checkbox" name="override" value="yes" /> Proceed anyway if an exclusivity warning appears</label>
              <button disabled={dealPending} className="btn btn-primary">{dealPending ? "Creating…" : "Create deal"}</button>
            </form>
          )}
          {tab === "contact" && (
            <form action={contactAction} className="space-y-3">
              <Err s={contactState} />
              <div className="grid gap-3 sm:grid-cols-2">
                <F l="Full name" c="sm:col-span-2"><input name="full_name" required autoFocus className="input" /></F>
                <F l="Job title"><input name="job_title" className="input" /></F>
                <F l="Email"><input name="email" type="email" className="input" /></F>
                <F l="Company"><input name="company" className="input" /></F>
                <F l="Agency"><input name="agency" className="input" /></F>
                <F l="Phone"><input name="phone" className="input" /></F>
                <F l="Type"><select name="contact_type" className="input"><option value="">Not set</option>{["Brand", "Agency", "PR", "Influencer marketing", "Talent manager", "Social", "Creative", "Marketing", "Production", "Tourism board", "Affiliate", "Other"].map((c) => <option key={c}>{c}</option>)}</select></F>
              </div>
              <button disabled={contactPending} className="btn btn-primary">{contactPending ? "Saving…" : "Add contact"}</button>
            </form>
          )}
          {tab === "company" && (
            <form action={companyAction} className="space-y-3">
              <Err s={companyState} />
              <div className="grid gap-3 sm:grid-cols-2">
                <F l="Company name" c="sm:col-span-2"><input name="name" required autoFocus className="input" /></F>
                <F l="Category"><select name="category" className="input"><option value="">Not set</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></F>
                <F l="Type"><input name="company_type" className="input" placeholder="Brand, label, tourism board…" /></F>
                <F l="Website"><input name="website" className="input" /></F>
                <F l="Country"><input name="country" className="input" /></F>
              </div>
              <label className="flex items-center gap-2 text-[12.5px] text-mute"><input type="checkbox" name="override" value="yes" /> Create even if the name already exists</label>
              <button disabled={companyPending} className="btn btn-primary">{companyPending ? "Saving…" : "Add company"}</button>
            </form>
          )}
          {tab === "invoice" && (
            <div className="space-y-3 text-[13.5px] text-mute">
              <p>Invoices are built from a deal so the client, amount and deliverables come through. Pick a deal on the invoice screen, or start blank.</p>
              <a href="/invoices/new" className="btn btn-primary" onClick={onClose}>Open invoice builder</a>
            </div>
          )}
          {tab === "payment" && (
            <form action={(fd) => done(addPayment, fd)} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><DealPick deals={deals} required /></div>
                <F l="Amount received"><input name="amount" required className="input" inputMode="decimal" /></F>
                <F l="Currency"><Cur /></F>
                <F l="Date"><input type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" /></F>
                <F l="Method"><select name="method" className="input"><option value="">Not recorded</option>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select></F>
                <F l="Reference" c="sm:col-span-2"><input name="reference" className="input" placeholder="Transaction or wire reference" /></F>
              </div>
              <label className="flex items-center gap-2 text-[12.5px] text-mute"><input type="checkbox" name="settles" value="yes" /> This settles the deal in full</label>
              <button className="btn btn-primary">Record payment</button>
            </form>
          )}
          {tab === "followup" && (
            <form action={taskAction} className="space-y-3" onSubmit={() => setTimeout(onClose, 400)}>
              <Err s={taskState} />
              <F l="What needs doing"><input name="title" required autoFocus className="input" placeholder="Follow up with Sarah on the proposal" /></F>
              <div className="grid gap-3 sm:grid-cols-2"><F l="Due date"><input type="date" name="due_date" className="input" /></F><DealPick deals={deals} /></div>
              <input type="hidden" name="kind" value="follow-up" />
              <button disabled={taskPending} className="btn btn-primary">Add follow-up</button>
            </form>
          )}
          {tab === "expense" && (
            <form action={(fd) => done(addExpense, fd)} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><DealPick deals={deals} /></div>
                <F l="Category"><select name="category" className="input">{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></F>
                <F l="Amount"><input name="amount" required className="input" inputMode="decimal" /></F>
                <F l="Currency"><Cur /></F>
                <F l="Date"><input type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" /></F>
                <F l="Description" c="sm:col-span-2"><input name="description" className="input" /></F>
              </div>
              <button className="btn btn-primary">Add expense</button>
            </form>
          )}
          {tab === "deliverable" && (
            <form action={(fd) => done(addDeliverable, fd)} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><DealPick deals={deals} required /></div>
                <F l="Platform"><select name="platform" className="input"><option value="">Not recorded</option>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select></F>
                <F l="Content type"><select name="content_type" className="input"><option value="">Not recorded</option>{CONTENT_TYPES.map((p) => <option key={p}>{p}</option>)}</select></F>
                <F l="Quantity"><input name="quantity" type="number" step="0.5" min="0" className="input" /></F>
                <F l="Deadline"><input type="date" name="deadline" className="input" /></F>
              </div>
              <button className="btn btn-primary">Add deliverable</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
