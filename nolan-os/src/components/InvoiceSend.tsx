"use client";
import { useActionState, useState } from "react";
import { sendInvoiceEmail } from "@/lib/actions";
import { MAIL_KINDS, buildInvoiceEmail, type Brand, type MailKind } from "@/lib/invoice-mail";

type Props = { id: string; number: string; to: string; clientName: string | null; service: string; amount: string; dueText: string; brand: Brand; alreadySent: boolean; smtp: { configured: boolean; user?: string } };

/** Writes the email for you; sends it with the PDF attached when SMTP is set up, otherwise opens it in your own mail app / Gmail. */
export function InvoiceSend({ id, number, to, clientName, service, amount, dueText, brand, alreadySent, smtp }: Props) {
  const [state, action, pending] = useActionState(sendInvoiceEmail, null);
  const make = (kind: MailKind) => buildInvoiceEmail({ kind, clientName, service, number, amount, dueText, brand });
  const [kind, setKind] = useState<MailKind>(alreadySent ? "reminder" : "booking");
  const [addr, setAddr] = useState(to);
  const first = make(kind);
  const [subject, setSubject] = useState(first.subject);
  const [body, setBody] = useState(first.body);
  const pickKind = (k: MailKind) => { setKind(k); const m = make(k); setSubject(m.subject); setBody(m.body); };
  const mailto = `mailto:${encodeURIComponent(addr)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(addr)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return (
    <div className="space-y-2.5 text-[13px]" id="send">
      <div className="flex flex-wrap gap-1.5">{MAIL_KINDS.map((m) => <button key={m.kind} type="button" onClick={() => pickKind(m.kind)} className={`rounded-full border px-2.5 py-0.5 text-[12px] ${m.kind === kind ? "border-ink bg-ink text-white" : "border-line/20 text-mute"}`}>{m.label}</button>)}</div>
      {state?.error && <p className="rounded-[5px] border border-bad/40 bg-bad/10 px-3 py-2 text-[12.5px] text-bad">{state.error}</p>}
      {state?.ok && <p className="rounded-[5px] border border-good/40 bg-good/10 px-3 py-2 text-[12.5px] text-good">{state.message}</p>}
      <form action={action} className="space-y-2.5">
        <input type="hidden" name="id" value={id} />
        <label className="block"><span className="label">To</span><input name="to" className="input" placeholder="client@email.com" value={addr} onChange={(e) => setAddr(e.target.value)} /></label>
        <label className="block"><span className="label">Subject</span><input name="subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
        <label className="block"><span className="label">Message</span><textarea name="body" className="input" rows={11} value={body} onChange={(e) => setBody(e.target.value)} /></label>
        <p className="text-[11.5px] text-faint">The invoice PDF is attached automatically when you send from here. Edit anything above first.</p>
        {smtp.configured ? (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[12px] text-mute"><input type="checkbox" name="copy_me" /> Send me a copy ({smtp.user})</label>
            <button disabled={pending} onClick={(e) => { if (!confirm(`Send this email to ${addr || "the client"} now?`)) e.preventDefault(); }} className="btn btn-primary w-full">{pending ? "Sending…" : "Send invoice now"}</button>
          </div>
        ) : (
          <p className="rounded-[5px] border border-line/15 bg-line/5 px-3 py-2 text-[12px] text-mute">One-click sending is not connected yet. Use the buttons below, or set it up once in <a href="/settings#email" className="link">Settings → Sending email</a>.</p>
        )}
      </form>
      <div className="flex flex-wrap gap-2 border-t border-line/10 pt-3">
        <a href={gmail} target="_blank" rel="noreferrer" className="btn btn-sm">Open in Gmail</a>
        <a href={mailto} className="btn btn-sm">Open in mail app</a>
        <a href={`/api/invoices/${id}/pdf`} className="btn btn-sm">Download PDF to attach</a>
        <button type="button" className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(`${subject}\n\n${body}`)}>Copy message</button>
      </div>
      <p className="text-[11.5px] text-faint">Gmail and your mail app cannot attach the PDF for you: download it and drag it in. Then press “Mark as sent” below.</p>
    </div>
  );
}
