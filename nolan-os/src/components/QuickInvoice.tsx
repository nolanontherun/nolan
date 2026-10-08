"use client";
import { useActionState, useMemo, useState } from "react";
import { createQuickInvoice } from "@/lib/actions";
import { CURRENCIES, SYMBOL } from "@/lib/constants";
import { addressLines, currencyName, longDate, type Brand } from "@/lib/invoice-mail";

export type QuickClient = { id: string; name: string; email: string | null; phone: string | null; company: string | null };
type Line = { title: string; detail: string; qty: string; amount: string };
const PRESETS = ["Wedding videography", "Instagram Reel", "YouTube integration", "Brand film", "Photography", "Video editing", "Usage rights"];
const num = (s: string) => parseFloat(s.replace(/[,$€£\s]/g, "")) || 0;
const fmt = (n: number, cur: string) => `${SYMBOL[cur] ?? `${cur} `}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function QuickInvoice({ clients, defaults, brand, preselect }: { clients: QuickClient[]; defaults: { number: string; issue: string; currency: string; notes: string }; brand: Brand; preselect?: string }) {
  const [state, action, pending] = useActionState(createQuickInvoice, null);
  const [mode, setMode] = useState<"known" | "new">(clients.length ? "known" : "new");
  const [pick, setPick] = useState<string>(preselect && clients.some((c) => c.id === preselect) ? preselect : "");
  const [q, setQ] = useState("");
  const [nw, setNw] = useState({ name: "", email: "", phone: "", company: "", address: "" });
  const [lines, setLines] = useState<Line[]>([{ title: "", detail: "", qty: "1", amount: "" }]);
  const [cur, setCur] = useState(defaults.currency);
  const [dueMode, setDueMode] = useState<"receipt" | "date" | "net">("receipt");
  const [dueDate, setDueDate] = useState(""); const [netDays, setNetDays] = useState("30");
  const [project, setProject] = useState(""); const [notes, setNotes] = useState(defaults.notes);
  const [issue, setIssue] = useState(defaults.issue); const [number, setNumber] = useState(defaults.number);
  const set = (n: number, k: keyof Line, v: string) => setLines((xs) => xs.map((x, i) => (i === n ? { ...x, [k]: v } : x)));
  const total = lines.reduce((s, l) => s + (num(l.qty) || 1) * num(l.amount), 0);
  const chosen = clients.find((c) => c.id === pick) ?? null;
  const shown = useMemo(() => { const t = q.trim().toLowerCase(); const list = t ? clients.filter((c) => `${c.name} ${c.email ?? ""} ${c.company ?? ""}`.toLowerCase().includes(t)) : clients; return list.slice(0, 8); }, [clients, q]);
  const billName = mode === "known" ? chosen?.name : nw.name;
  const billLines = mode === "known" ? [chosen?.email, chosen?.phone] : [nw.email, nw.phone, nw.address];
  const dueLabel = dueMode === "receipt" ? "On receipt" : dueMode === "date" ? longDate(dueDate) || "Pick a date" : `Net ${netDays}`;

  return (
    <form action={action} className="grid gap-x-12 gap-y-8 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-8">
        {state?.error && <p className="rounded-[5px] border border-bad/40 bg-bad/10 px-3 py-2 text-[12.5px] text-bad">{state.error}</p>}
        <input type="hidden" name="mode" value={mode} /><input type="hidden" name="client_id" value={mode === "known" ? pick : ""} /><input type="hidden" name="currency" value={cur} />

        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="caps">1 · Who is it for?</h2>
            <div className="flex gap-1 text-[12px]">{(["known", "new"] as const).map((m) => <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-full border px-2.5 py-0.5 ${mode === m ? "border-ink bg-ink text-white" : "border-line/20 text-mute"}`}>{m === "known" ? "Someone I know" : "Add a new client"}</button>)}</div></div>
          {mode === "known" ? (
            <div>
              <input className="input" placeholder={`Search ${clients.length} people by name, email or company`} value={q} onChange={(e) => setQ(e.target.value)} />
              <ul className="mt-2 divide-y divide-line/[0.07] rounded-[5px] border border-line/15">
                {shown.map((c) => <li key={c.id}><button type="button" onClick={() => setPick(c.id)} className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] ${pick === c.id ? "bg-accent/10" : "hover:bg-line/5"}`}><span><b className="font-medium">{c.name}</b>{c.company && <span className="text-mute"> · {c.company}</span>}</span><span className="truncate text-[12px] text-faint">{c.email ?? "no email"}</span></button></li>)}
                {!shown.length && <li className="px-3 py-3 text-[13px] text-faint">No match. Use “Add a new client”.</li>}
              </ul>
              {chosen && !chosen.email && <p className="mt-2 text-[12px] text-warn">{chosen.name} has no email on record. You can still make the invoice and add the address when you send it.</p>}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className="label">Name</span><input name="new_name" className="input" value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} /></label>
              <label><span className="label">Email</span><input name="new_email" type="email" className="input" value={nw.email} onChange={(e) => setNw({ ...nw, email: e.target.value })} /></label>
              <label><span className="label">Phone (optional)</span><input name="new_phone" className="input" value={nw.phone} onChange={(e) => setNw({ ...nw, phone: e.target.value })} /></label>
              <label><span className="label">Company (optional)</span><input name="new_company" className="input" value={nw.company} onChange={(e) => setNw({ ...nw, company: e.target.value })} /></label>
              <label className="sm:col-span-2"><span className="label">Billing address (optional)</span><input name="bill_to_address" className="input" value={nw.address} onChange={(e) => setNw({ ...nw, address: e.target.value })} /></label>
              <p className="text-[11.5px] text-faint sm:col-span-2">New clients are saved to Contacts so you can pick them next time.</p>
            </div>
          )}
        </section>

        <section>
          <h2 className="caps mb-3">2 · What are you charging for?</h2>
          <div className="mb-3 flex flex-wrap gap-1.5">{PRESETS.map((p) => <button key={p} type="button" onClick={() => set(0, "title", p)} className={`rounded-full border px-2.5 py-0.5 text-[12px] ${lines[0].title === p ? "border-ink bg-ink text-white" : "border-line/20 text-mute"}`}>{p}</button>)}</div>
          <div className="space-y-3">
            {lines.map((l, n) => (
              <div key={n} className="grid grid-cols-[1fr_120px_28px] items-start gap-2">
                <div className="space-y-2"><input name="item_title" className="input" placeholder="What (e.g. Wedding videography)" value={l.title} onChange={(e) => set(n, "title", e.target.value)} /><input name="item_detail" className="input" placeholder="Details (e.g. Havilah Ranch · October 31, 2026)" value={l.detail} onChange={(e) => set(n, "detail", e.target.value)} /><input type="hidden" name="item_qty" value={l.qty} /></div>
                <input name="item_amount" className="input text-right" inputMode="decimal" placeholder={`Price (${SYMBOL[cur]?.trim() ?? cur})`} value={l.amount} onChange={(e) => set(n, "amount", e.target.value)} />
                <button type="button" onClick={() => setLines((xs) => (xs.length > 1 ? xs.filter((_, i) => i !== n) : xs))} className="btn btn-ghost !px-0 text-mute" aria-label="Remove line">×</button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between"><button type="button" onClick={() => setLines((xs) => [...xs, { title: "", detail: "", qty: "1", amount: "" }])} className="btn btn-sm">Add another line</button>
            <label className="flex items-center gap-2 text-[12px] text-mute">Currency<select value={cur} onChange={(e) => setCur(e.target.value)} className="input !w-24">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label></div>
        </section>

        <section>
          <h2 className="caps mb-3">3 · When is it due?</h2>
          <input type="hidden" name="due_mode" value={dueMode} />
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            {([["receipt", "On receipt"], ["date", "On a date"], ["net", "In X days"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setDueMode(k)} className={`rounded-full border px-3 py-1 ${dueMode === k ? "border-ink bg-ink text-white" : "border-line/20 text-mute"}`}>{l}</button>)}
            {dueMode === "date" && <input type="date" name="due_date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input !w-44" />}
            {dueMode === "net" && <select name="net_days" value={netDays} onChange={(e) => setNetDays(e.target.value)} className="input !w-28">{["7", "14", "15", "30", "45", "60"].map((d) => <option key={d} value={d}>{d} days</option>)}</select>}
          </div>
          <p className="mt-2 text-[12px] text-faint">For a wedding, choose “On a date” and pick the wedding day.</p>
        </section>

        <details className="text-[13px]"><summary className="cursor-pointer text-mute">More options (project line, note, number, issue date)</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2"><span className="label">Project line (optional)</span><input name="project" className="input" value={project} onChange={(e) => setProject(e.target.value)} placeholder="Shown above the table" /></label>
            <label className="sm:col-span-2"><span className="label">Closing note</span><input name="notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
            <label><span className="label">Invoice number</span><input name="number" className="input" value={number} onChange={(e) => setNumber(e.target.value)} /></label>
            <label><span className="label">Issue date</span><input type="date" name="issue_date" className="input" value={issue} onChange={(e) => setIssue(e.target.value)} /></label>
          </div>
        </details>

        <div className="flex flex-wrap gap-2">
          <button name="intent" value="email" disabled={pending} className="btn btn-primary">{pending ? "Creating…" : "Create & write the email"}</button>
          <button name="intent" value="create" disabled={pending} className="btn">Create invoice</button>
        </div>
      </div>

      {/* live preview, same look as the PDF */}
      <aside className="xl:sticky xl:top-6 xl:self-start">
        <div className="caps mb-2">Preview</div>
        <div className="rounded-[3px] border border-[#E6DCC9] bg-[#FBF8F2] p-7 text-[#2B2722] shadow-[0_20px_50px_-30px_rgba(0,0,0,0.35)]" style={{ colorScheme: "light" }}>
          <div className="text-center"><div className="text-[8px] uppercase tracking-[0.25em] text-[#B58E55]">{brand.production}</div><div className="mt-1 font-serif text-[26px] leading-tight">{brand.legal}</div><div className="mx-auto my-2 h-px w-8 bg-[#B58E55]" /><div className="font-serif text-[13px] italic text-[#6F685D]">Invoice</div></div>
          <div className="mt-4 grid grid-cols-3 border-b border-[#E6DCC9] pb-3 text-center">{[["Invoice no.", number || "—"], ["Issued", longDate(issue)], ["Due", dueLabel]].map(([l, v]) => <div key={l}><div className="text-[7px] uppercase tracking-[0.2em] text-[#B58E55]">{l}</div><div className="mt-0.5 font-serif text-[11px]">{v}</div></div>)}</div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-[10px]"><div><div className="text-[7px] uppercase tracking-[0.2em] text-[#B58E55]">Prepared for</div><div className="mt-1 font-serif text-[14px]">{billName || "Client name"}</div><div className="whitespace-pre-line text-[#6F685D]">{billLines.filter(Boolean).join("\n")}</div></div><div><div className="text-[7px] uppercase tracking-[0.2em] text-[#B58E55]">From</div><div className="mt-1 font-serif text-[14px]">{brand.legal}</div><div className="whitespace-pre-line text-[#6F685D]">{[...addressLines(brand.address), brand.email].join("\n")}</div></div></div>
          {project && <div className="mt-3 font-serif text-[12px]">{project}</div>}
          <div className="mt-4 bg-[#F3EADB] px-3 py-1.5 text-[7px] uppercase tracking-[0.2em] text-[#B58E55]"><span>Description</span><span className="float-right">Amount</span></div>
          {lines.map((l, i) => <div key={i} className="flex justify-between gap-3 border-b border-[#E6DCC9] px-3 py-2.5"><div><div className="font-serif text-[13px]">{l.title || "What you are charging for"}</div>{l.detail && <div className="text-[9px] text-[#6F685D]">{l.detail}</div>}</div><div className="text-[11px] tabular-nums">{fmt(num(l.amount) * (num(l.qty) || 1), cur)}</div></div>)}
          <div className="mt-4 flex items-end justify-between"><div className="text-[7px] uppercase tracking-[0.2em] text-[#B58E55]">Total due</div><div className="text-right"><div className="font-serif text-[26px] leading-none tabular-nums">{fmt(total, cur)}</div><div className="mt-1 text-[8.5px] text-[#6F685D]">{currencyName(cur)} · {dueMode === "receipt" ? "due on receipt" : `due ${dueLabel}`}</div></div></div>
          <div className="mx-auto my-4 h-px w-8 bg-[#B58E55]" /><div className="text-center font-serif text-[14px] italic">{notes || "Thank you for trusting me."}</div>
        </div>
      </aside>
    </form>
  );
}
