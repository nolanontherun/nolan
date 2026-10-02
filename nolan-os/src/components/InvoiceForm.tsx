"use client";
import { useActionState, useState } from "react";
import { createInvoice } from "@/lib/actions";
import { CURRENCIES } from "@/lib/constants";

type Item = { d: string; q: string; a: string };
export function InvoiceForm({ deals, initial }: { deals: { id: string; name: string }[]; initial: { deal_id: string; currency: string; number: string; terms: string; issue: string; due: string; description: string; bill_to_name: string; bill_to_email: string; bill_to_address: string; notes: string; items: Item[]; contact_id: string } }) {
  const [state, action, pending] = useActionState(createInvoice, null);
  const [items, setItems] = useState<Item[]>(initial.items.length ? initial.items : [{ d: "", q: "1", a: "" }]);
  const total = items.reduce((s, i) => s + (parseFloat(i.q) || 0) * (parseFloat(i.a.replace(/[,$€£\s]/g, "")) || 0), 0);
  const set = (n: number, k: keyof Item, v: string) => setItems((xs) => xs.map((x, i) => (i === n ? { ...x, [k]: v } : x)));
  return (
    <form action={action} className="grid gap-x-12 gap-y-6 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-5">
        {state?.error && <p className="rounded-[5px] border border-bad/40 bg-bad/10 px-3 py-2 text-[12.5px] text-bad">{state.error}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className="label">Deal</span><select name="deal_id" defaultValue={initial.deal_id} className="input"><option value="">No deal (standalone)</option>{deals.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label><span className="label">Project description</span><input name="description" defaultValue={initial.description} className="input" /></label>
          <label><span className="label">Bill to</span><input name="bill_to_name" defaultValue={initial.bill_to_name} className="input" /></label>
          <label><span className="label">Billing email</span><input name="bill_to_email" defaultValue={initial.bill_to_email} className="input" /></label>
          <label className="sm:col-span-2"><span className="label">Billing address</span><textarea name="bill_to_address" defaultValue={initial.bill_to_address} className="input" /></label>
          <input type="hidden" name="contact_id" value={initial.contact_id} />
        </div>
        <div>
          <div className="caps mb-2">Line items</div>
          <div className="space-y-2">
            {items.map((it, n) => (
              <div key={n} className="grid grid-cols-[1fr_64px_110px_28px] gap-2">
                <input name="item_desc" value={it.d} onChange={(e) => set(n, "d", e.target.value)} placeholder="Description" className="input" />
                <input name="item_qty" value={it.q} onChange={(e) => set(n, "q", e.target.value)} inputMode="decimal" className="input text-right" aria-label="Quantity" />
                <input name="item_amount" value={it.a} onChange={(e) => set(n, "a", e.target.value)} inputMode="decimal" placeholder="Rate" className="input text-right" />
                <button type="button" onClick={() => setItems((xs) => (xs.length > 1 ? xs.filter((_, i) => i !== n) : xs))} className="btn btn-ghost !px-0 text-mute" aria-label="Remove line">×</button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between"><button type="button" onClick={() => setItems((xs) => [...xs, { d: "", q: "1", a: "" }])} className="btn btn-sm">Add line</button><span className="text-[13px] tabular-nums text-mute">Total {total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
        </div>
      </div>
      <div className="space-y-3">
        <label className="block"><span className="label">Invoice number</span><input name="number" defaultValue={initial.number} className="input" /><span className="mt-1 block text-[11.5px] text-faint">Next number in your sequence. Change the prefix in Settings.</span></label>
        <div className="grid grid-cols-2 gap-3"><label><span className="label">Issue date</span><input type="date" name="issue_date" defaultValue={initial.issue} className="input" /></label><label><span className="label">Due date</span><input type="date" name="due_date" defaultValue="" className="input" /></label></div>
        <div className="grid grid-cols-2 gap-3"><label><span className="label">Payment terms</span><input name="terms" defaultValue={initial.terms} className="input" /></label><label><span className="label">Currency</span><select name="currency" defaultValue={initial.currency} className="input">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label></div>
        <label className="block"><span className="label">Notes</span><textarea name="notes" defaultValue={initial.notes} className="input" /></label>
        <p className="text-[11.5px] text-faint">Leave the due date empty and it is calculated from the terms.</p>
        <button disabled={pending} className="btn btn-primary w-full">{pending ? "Creating…" : "Create draft invoice"}</button>
      </div>
    </form>
  );
}
