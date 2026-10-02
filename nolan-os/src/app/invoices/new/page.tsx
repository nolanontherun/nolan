import { all, get, getSetting } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { InvoiceForm } from "@/components/InvoiceForm";
import { nextInvoiceNumber } from "@/lib/invoice";
import { loadDeals } from "@/lib/queries";
import { today } from "@/lib/format";

export const metadata = { title: "New invoice" };
export default async function NewInvoice({ searchParams }: { searchParams: Promise<{ deal?: string }> }) {
  const { deal } = await searchParams;
  const deals = loadDeals();
  const d = deal ? deals.find((x) => x.id === deal) : undefined;
  const dels = d ? all<any>("SELECT * FROM deliverables WHERE deal_id = ?", d.id) : [];
  const contact = d?.contact_id ? get<any>("SELECT * FROM contacts WHERE id = ?", d.contact_id) : null;
  const inv = getSetting<any>("invoice", { defaultTerms: "Net 30", notes: "" });
  const summary = dels.map((x) => `${x.quantity ?? ""} ${[x.platform, x.content_type].filter(Boolean).join(" ")}`.trim()).filter(Boolean).join(", ");
  const items: { d: string; q: string; a: string }[] = [];
  if (d) {
    const outstanding = d.fin.outstanding?.amount ?? d.fin.gross;
    items.push({ d: `${d.name}${summary ? ` — ${summary}` : ""}`, q: "1", a: d.final_amount !== null ? String(d.final_amount / 100) : outstanding ? String(outstanding / 100) : "" });
    if (d.usage_fee) items.push({ d: "Usage rights", q: "1", a: String(d.usage_fee / 100) });
    if (d.exclusivity_fee) items.push({ d: "Exclusivity", q: "1", a: String(d.exclusivity_fee / 100) });
    if (d.whitelisting_fee) items.push({ d: "Whitelisting", q: "1", a: String(d.whitelisting_fee / 100) });
  }
  return (
    <div>
      <PageHeader title="New invoice" kicker="Invoices" sub={d ? `Built from ${d.name}. Check every line before you send it.` : "Start from a deal to bring the client and amounts in, or fill it in by hand."} />
      <InvoiceForm deals={deals.map((x) => ({ id: x.id, name: x.name }))} initial={{ deal_id: d?.id ?? "", currency: d?.currency ?? "USD", number: nextInvoiceNumber(), terms: d?.payment_terms?.match(/net\s?\d+/i)?.[0] ?? inv.defaultTerms, issue: today(), due: "", description: d ? (d.name) : "", bill_to_name: d?.agency_name ?? d?.company_name ?? "", bill_to_email: contact?.email ?? "", bill_to_address: "", notes: inv.notes ?? "", items, contact_id: contact?.id ?? "" }} />
    </div>
  );
}
