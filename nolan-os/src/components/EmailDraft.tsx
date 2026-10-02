"use client";
import { useState } from "react";

type Kind = "followup" | "payment" | "invoice" | "thanks";
const TEMPLATES: Record<Kind, { label: string; subject: (d: string) => string; body: (n: string, d: string, amt: string) => string }> = {
  followup: { label: "Follow up", subject: (d) => `Re: ${d}`, body: (n, d) => `Hi ${n},\n\nJust following up on ${d}. Let me know if you need anything from me.\n\nThanks,\nNolan` },
  payment: { label: "Payment reminder", subject: (d) => `Payment status: ${d}`, body: (n, d, a) => `Hi ${n},\n\nA quick check on payment for ${d}${a ? ` (${a})` : ""}. Could you let me know when it is scheduled?\n\nThanks,\nNolan` },
  invoice: { label: "Invoice sent", subject: (d) => `Invoice: ${d}`, body: (n, d) => `Hi ${n},\n\nHere is the invoice for ${d}. Let me know if anything is missing.\n\nThanks,\nNolan` },
  thanks: { label: "Thank you", subject: (d) => `Thank you: ${d}`, body: (n, d) => `Hi ${n},\n\nThank you for working with me on ${d}. Happy to do more together.\n\nNolan` },
};

/** Opens a draft in your own mail app (mailto). Nothing is sent from here and no password is stored. */
export function EmailDraft({ to, name, deal, amount, defaultKind = "followup" }: { to: string | null; name: string | null; deal: string; amount?: string; defaultKind?: Kind }) {
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [addr, setAddr] = useState(to ?? "");
  const t = TEMPLATES[kind];
  const first = (name ?? "there").split(" ")[0];
  const [subject, setSubject] = useState(t.subject(deal));
  const [body, setBody] = useState(t.body(first, deal, amount ?? ""));
  const pick = (k: Kind) => { setKind(k); setSubject(TEMPLATES[k].subject(deal)); setBody(TEMPLATES[k].body(first, deal, amount ?? "")); };
  const href = `mailto:${encodeURIComponent(addr)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(addr)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return (
    <div className="space-y-2 text-[13px]">
      <div className="flex flex-wrap gap-1.5">{(Object.keys(TEMPLATES) as Kind[]).map((k) => <button key={k} type="button" onClick={() => pick(k)} className={`rounded-full border px-2.5 py-0.5 text-[12px] ${k === kind ? "border-ink bg-ink text-white" : "border-line/20 text-mute"}`}>{TEMPLATES[k].label}</button>)}</div>
      <input className="input" placeholder="To (email address)" value={addr} onChange={(e) => setAddr(e.target.value)} />
      <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <textarea className="input" rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="flex gap-2">
        <a href={href} className="btn btn-sm">Open in mail app</a>
        <a href={gmail} target="_blank" rel="noreferrer" className="btn btn-sm">Open in Gmail</a>
        <button type="button" className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(`${subject}\n\n${body}`)}>Copy</button>
      </div>
    </div>
  );
}
