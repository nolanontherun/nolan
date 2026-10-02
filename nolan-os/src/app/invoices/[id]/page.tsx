import Link from "next/link";
import { notFound } from "next/navigation";
import { loadInvoice } from "@/lib/invoice";
import { dateLabel, money } from "@/lib/format";
import { Badge, Section } from "@/components/ui";
import { addPayment, invoiceAction } from "@/lib/actions";
import { ConfirmForm, PrintButton } from "@/components/Forms";
import { PAYMENT_METHODS } from "@/lib/constants";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return { title: loadInvoice(id)?.inv.number ?? "Invoice" }; }

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const f = loadInvoice(id);
  if (!f) notFound();
  const { inv, items, payments, contact, paid, total, balance, label, profile, settings } = f;
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
        {/* paper preview */}
        <div className="print-page mx-auto w-full max-w-[760px] rounded-[3px] border border-line/10 bg-white p-8 text-[#16140F] shadow-[0_1px_0_rgba(0,0,0,0.04),0_20px_50px_-30px_rgba(0,0,0,0.35)] sm:p-12" style={{ colorScheme: "light" }}>
          <div className="flex items-start justify-between gap-6 border-b border-[#16140F] pb-6">
            <div><div className="font-serif text-[30px] leading-none">{profile.business || "Nolan On The Run"}</div><div className="mt-2 text-[11.5px] leading-relaxed text-[#6B665B]">{[profile.name, profile.email, profile.website, profile.address].filter(Boolean).join("  ·  ")}</div></div>
            <div className="text-right"><div className="text-[10px] font-semibold tracking-[0.2em] text-[#6B665B]">INVOICE</div><div className="font-serif text-[26px] leading-tight">{inv.number ?? "—"}</div></div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-6 text-[12.5px] sm:grid-cols-4">
            <div className="col-span-2"><div className="text-[9.5px] font-semibold tracking-[0.14em] text-[#6B665B]">BILL TO</div><div className="mt-1 whitespace-pre-line leading-snug">{[inv.bill_to_name || inv.company_name, contact?.full_name, inv.bill_to_address, inv.bill_to_email || contact?.email].filter(Boolean).join("\n")}</div></div>
            <div><div className="text-[9.5px] font-semibold tracking-[0.14em] text-[#6B665B]">ISSUED</div><div className="mt-1">{inv.issue_date ? dateLabel(inv.issue_date, { year: true }) : "—"}</div><div className="mt-3 text-[9.5px] font-semibold tracking-[0.14em] text-[#6B665B]">TERMS</div><div className="mt-1">{inv.terms ?? "—"}</div></div>
            <div><div className="text-[9.5px] font-semibold tracking-[0.14em] text-[#6B665B]">DUE</div><div className="mt-1">{inv.due_date ? dateLabel(inv.due_date, { year: true }) : "On receipt"}</div><div className="mt-3 text-[9.5px] font-semibold tracking-[0.14em] text-[#6B665B]">CURRENCY</div><div className="mt-1">{inv.currency}</div></div>
          </div>
          {(inv.description || inv.deal_name) && <div className="mt-6 text-[12.5px]"><div className="text-[9.5px] font-semibold tracking-[0.14em] text-[#6B665B]">PROJECT</div><div className="mt-1">{inv.description || inv.deal_name}</div></div>}
          <table className="mt-7 w-full border-collapse text-[12.5px]"><thead><tr className="border-b border-[#D9D4C8] text-left text-[9.5px] font-semibold tracking-[0.14em] text-[#6B665B]"><th className="py-2">DESCRIPTION</th><th className="w-14 py-2 text-right">QTY</th><th className="w-28 py-2 text-right">RATE</th><th className="w-28 py-2 text-right">AMOUNT</th></tr></thead><tbody>
            {items.map((it: any) => <tr key={it.id} className="border-b border-[#ECE8DE]"><td className="py-3 pr-4 leading-snug">{it.description}</td><td className="py-3 text-right tabular-nums">{it.quantity}</td><td className="py-3 text-right tabular-nums">{money(it.unit_amount, inv.currency, { cents: true })}</td><td className="py-3 text-right tabular-nums">{money(Math.round(it.quantity * it.unit_amount), inv.currency, { cents: true })}</td></tr>)}
            {!items.length && <tr><td colSpan={4} className="py-4 text-[#6B665B]">{inv.description ?? "No line items recorded for this invoice."}</td></tr>}
          </tbody></table>
          <div className="ml-auto mt-5 w-full max-w-[280px] text-[12.5px]">
            <div className="flex justify-between py-1"><span>Subtotal</span><span className="tabular-nums">{money(total, inv.currency, { cents: true })}</span></div>
            {paid > 0 && <div className="flex justify-between py-1"><span>Paid</span><span className="tabular-nums">−{money(paid, inv.currency, { cents: true })}</span></div>}
            <div className="mt-1 flex justify-between border-t border-[#16140F] pt-2 text-[15px] font-semibold"><span>{paid > 0 ? "Balance due" : "Total due"}</span><span className="tabular-nums">{money(balance, inv.currency, { cents: true })}</span></div>
          </div>
          <div className="mt-9 grid gap-6 text-[12px] sm:grid-cols-2">
            <div><div className="text-[9.5px] font-semibold tracking-[0.14em] text-[#6B665B]">PAYMENT INFORMATION</div><div className="mt-1 whitespace-pre-line leading-snug">{settings.paymentInfo || <span className="text-[#6B665B]">Add your bank or payment details in Settings to show them here.</span>}</div></div>
            {inv.notes && <div><div className="text-[9.5px] font-semibold tracking-[0.14em] text-[#6B665B]">NOTES</div><div className="mt-1 whitespace-pre-line leading-snug">{inv.notes}</div></div>}
          </div>
        </div>
        {/* actions */}
        <aside className="no-print space-y-7">
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
