import Link from "next/link";
import { notFound } from "next/navigation";
import { loadInvoice } from "@/lib/invoice";
import { dateLabel, money } from "@/lib/format";
import { Badge, Section } from "@/components/ui";
import { addPayment, invoiceAction } from "@/lib/actions";
import { ConfirmForm, PrintButton } from "@/components/Forms";
import { PAYMENT_METHODS } from "@/lib/constants";
import { InvoiceSend } from "@/components/InvoiceSend";
import { smtpStatus } from "@/lib/mailer";
import { addressLines, brandFrom, currencyName, dueDisplay, isReceipt, longDate, splitItem } from "@/lib/invoice-mail";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return { title: loadInvoice(id)?.inv.number ?? "Invoice" }; }

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const f = loadInvoice(id);
  if (!f) notFound();
  const { inv, items, payments, contact, paid, total, balance, label, profile, settings } = f;
  const brand = brandFrom(profile); const due = dueDisplay(inv.terms, inv.due_date); const smtp = smtpStatus();
  const service = items.length ? splitItem(items[0].description).title : inv.description ?? "";
  const A = ({ act, children, ghost }: { act: string; children: React.ReactNode; ghost?: boolean }) => <form action={invoiceAction}><input type="hidden" name="id" value={id} /><input type="hidden" name="act" value={act} /><button className={`btn btn-sm ${ghost ? "btn-ghost" : ""}`}>{children}</button></form>;
  return (
    <div>
      <div className="no-print mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-line/10 pb-5">
        <div><div className="caps mb-1.5">Invoice · <Link href="/invoices" className="hover:text-accent">All invoices</Link></div><h1 className="serif text-[38px] leading-none">{inv.number ?? "Number not recorded"}</h1><div className="mt-2 flex items-center gap-2"><Badge tone={label === "Paid" ? "good" : label === "Overdue" ? "bad" : "mute"}>{label}</Badge>{inv.deal_id && <Link href={`/deals/${inv.deal_id}`} className="link text-[12.5px]">{inv.deal_name}</Link>}</div></div>
        <div className="flex flex-wrap items-center gap-1.5">
          <a href={`/api/invoices/${id}/pdf`} className="btn btn-primary btn-sm">Download PDF</a><PrintButton />
          <A act="duplicate">Duplicate</A>
        </div>
      </div>
      <div className="grid gap-x-10 gap-y-8 xl:grid-cols-[1fr_320px]">
        {/* paper preview: same look as the PDF */}
        <div className="print-page mx-auto w-full max-w-[760px] rounded-[3px] border border-[#E6DCC9] bg-[#FBF8F2] p-8 text-[#2B2722] shadow-[0_1px_0_rgba(0,0,0,0.04),0_20px_50px_-30px_rgba(0,0,0,0.35)] sm:p-14" style={{ colorScheme: "light" }}>
          <div className="text-center"><div className="text-[10px] uppercase tracking-[0.28em] text-[#B58E55]">{brand.production || "Invoice"}</div><div className="mt-1.5 font-serif text-[36px] leading-tight sm:text-[40px]">{brand.legal}</div><div className="mx-auto my-3 h-px w-9 bg-[#B58E55]" /><div className="font-serif text-[18px] italic text-[#6F685D]">Invoice</div></div>
          <div className="mt-8 grid grid-cols-3 border-b border-[#E6DCC9] pb-5 text-center">{[["Invoice no.", inv.number ?? "—"], ["Issued", longDate(inv.issue_date) || "—"], ["Due", due]].map(([l, v]) => <div key={l}><div className="text-[9px] uppercase tracking-[0.22em] text-[#B58E55]">{l}</div><div className="mt-1 font-serif text-[15px]">{v}</div></div>)}</div>
          <div className="mt-7 grid grid-cols-1 gap-6 text-[12.5px] sm:grid-cols-2">
            <div><div className="text-[9px] uppercase tracking-[0.22em] text-[#B58E55]">Prepared for</div><div className="mt-1.5 font-serif text-[20px] leading-tight">{inv.bill_to_name || contact?.full_name || inv.company_name || "Client"}</div><div className="mt-1 whitespace-pre-line leading-relaxed text-[#6F685D]">{[inv.bill_to_email || contact?.email, contact?.phone, inv.bill_to_address].filter(Boolean).join("\n")}</div></div>
            <div className="sm:pl-10"><div className="text-[9px] uppercase tracking-[0.22em] text-[#B58E55]">From</div><div className="mt-1.5 font-serif text-[20px] leading-tight">{brand.legal}</div><div className="mt-1 whitespace-pre-line leading-relaxed text-[#6F685D]">{[...addressLines(brand.address), brand.email].join("\n")}</div></div>
          </div>
          {inv.description && <div className="mt-7"><div className="text-[9px] uppercase tracking-[0.22em] text-[#B58E55]">Project</div><div className="mt-1 font-serif text-[18px]">{inv.description}</div></div>}
          <div className="mt-8 flex justify-between bg-[#F3EADB] px-4 py-2 text-[9px] uppercase tracking-[0.22em] text-[#B58E55]"><span>Description</span><span>Amount</span></div>
          {items.map((it: any) => { const sp = splitItem(it.description); const detail = [sp.detail, it.quantity !== 1 ? `${it.quantity} × ${money(it.unit_amount, inv.currency, { cents: true })}` : ""].filter(Boolean).join("  ·  "); return <div key={it.id} className="flex justify-between gap-4 border-b border-[#E6DCC9] px-4 py-5"><div><div className="font-serif text-[19px] leading-snug">{sp.title}</div>{detail && <div className="mt-1 text-[12px] text-[#6F685D]">{detail}</div>}</div><div className="whitespace-nowrap text-[15px] tabular-nums">{money(Math.round(it.quantity * it.unit_amount), inv.currency, { cents: true })}</div></div>; })}
          {!items.length && <div className="border-b border-[#E6DCC9] px-4 py-5 text-[#6F685D]">{inv.description ?? "No line items recorded for this invoice."}</div>}
          <div className="mt-6 flex items-end justify-between gap-4">
            <div className="text-[9px] uppercase tracking-[0.22em] text-[#B58E55]">{paid > 0 ? "Balance due" : "Total due"}</div>
            <div className="text-right">{paid > 0 && <div className="mb-1 text-[12px] text-[#6F685D]">Paid −{money(paid, inv.currency, { cents: true })}</div>}<div className="font-serif text-[40px] leading-none tabular-nums">{money(balance, inv.currency, { cents: true })}</div><div className="mt-1.5 text-[11px] text-[#6F685D]">{currencyName(inv.currency)} · {isReceipt(inv.terms) ? "due on receipt" : `due ${due}`}</div></div>
          </div>
          <div className="mx-auto my-8 h-px w-9 bg-[#B58E55]" />
          <div className="text-center font-serif text-[24px] italic">{inv.notes || "Thank you for trusting me."}</div>
          <div className="mt-10 grid gap-6 border-t border-[#E6DCC9] pt-5 text-[12px] sm:grid-cols-2">
            <div><div className="text-[9px] uppercase tracking-[0.22em] text-[#B58E55]">Payment</div><div className="mt-1.5 whitespace-pre-line leading-relaxed text-[#6F685D]">{settings.paymentInfo || <>I'll send the payment details by email. <a href="/settings" className="link no-print">Add them in Settings</a></>}</div></div>
            <div><div className="text-[9px] uppercase tracking-[0.22em] text-[#B58E55]">Questions</div><div className="mt-1.5 leading-relaxed text-[#6F685D]">{brand.email}<br />I'm happy to help with anything.</div></div>
          </div>
        </div>
        {/* actions */}
        <aside className="no-print space-y-7">
          <Section title="Email this invoice" id="send-section">
            <InvoiceSend id={id} number={inv.number ?? ""} to={inv.bill_to_email || contact?.email || ""} clientName={inv.bill_to_name || contact?.full_name || null} service={service} amount={money(total, inv.currency, { cents: true })} dueText={due} brand={brand} alreadySent={!!inv.sent_at} smtp={{ configured: smtp.configured, user: smtp.user }} />
          </Section>
          <Section title="Status">
            <div className="flex flex-wrap gap-1.5">
              <A act="sent">Mark as sent</A><A act="viewed">Mark as viewed</A><A act="disputed">Mark disputed</A>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <ConfirmForm action={invoiceAction} message="Void this invoice? It stays on record as Void."><input type="hidden" name="id" value={id} /><input type="hidden" name="act" value="void" /><button className="btn btn-sm btn-danger">Void</button></ConfirmForm>
              <ConfirmForm action={invoiceAction} message="Write this invoice off? Use this only when you will not be paid."><input type="hidden" name="id" value={id} /><input type="hidden" name="act" value="writeoff" /><button className="btn btn-sm btn-danger">Write off</button></ConfirmForm>
            </div>
            <p className="mt-3 text-[12px] text-faint">Sent {inv.sent_at ?? "not recorded"} · viewed {inv.viewed_at ?? "not recorded"}</p>
          </Section>
          <Section title="Payment">
            <div className="mb-3 text-[13px]">Balance <b>{money(balance, inv.currency, { cents: true })}</b></div>
            <form action={addPayment} className="grid gap-2.5"><input type="hidden" name="invoice_id" value={id} /><input type="hidden" name="currency" value={inv.currency} />
              <label><span className="label">Amount received</span><input name="amount" required className="input" inputMode="decimal" placeholder={balance ? String(balance / 100) : ""} /></label>
              <div className="grid grid-cols-2 gap-2"><label><span className="label">Date</span><input type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" /></label><label><span className="label">Method</span><select name="method" className="input"><option value="">—</option>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select></label></div>
              <label><span className="label">Reference</span><input name="reference" className="input" placeholder="Transaction number" /></label>
              <label><span className="label">Notes</span><input name="notes" className="input" /></label>
              <button className="btn btn-primary">Record payment</button>
            </form>
            <form action={invoiceAction} className="mt-2"><input type="hidden" name="id" value={id} /><input type="hidden" name="act" value="paid" /><button className="btn btn-sm w-full">Mark paid in full</button></form>
            {payments.length > 0 && <ul className="mt-4 border-t border-line/10">{payments.map((p: any) => <li key={p.id} className="flex justify-between border-b border-line/[0.07] py-2 text-[12.5px]"><span>{p.date ? dateLabel(p.date, { year: true }) : "No date"} · {p.method ?? "method not recorded"}</span><span className="tabular-nums">{money(p.amount, p.currency, { cents: true })}</span></li>)}</ul>}
          </Section>
        </aside>
      </div>
    </div>
  );
}
