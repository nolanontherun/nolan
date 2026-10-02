import PDFDocument from "pdfkit";
import { all, get, getSetting } from "./db";
import { dateLabel, money } from "./format";
import { invoiceStatusLabel } from "./calc";
import { today } from "./format";

export function nextInvoiceNumber(year = new Date().getFullYear()): string {
  const inv = getSetting<any>("invoice", { prefix: "NTR" });
  const prefix = `${inv.prefix || "NTR"}-${year}-`;
  const rows = all<{ number: string }>("SELECT number FROM invoices WHERE number LIKE ?", prefix + "%");
  const max = rows.reduce((m, r) => Math.max(m, parseInt(r.number.slice(prefix.length), 10) || 0), 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export type InvoiceFull = ReturnType<typeof loadInvoice>;
export function loadInvoice(id: string) {
  const inv = get<any>(`SELECT i.*, c.name company_name, d.name deal_name FROM invoices i LEFT JOIN companies c ON c.id = i.company_id LEFT JOIN deals d ON d.id = i.deal_id WHERE i.id = ?`, id);
  if (!inv) return null;
  const items = all<any>("SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY position", id);
  const payments = all<any>("SELECT * FROM payments WHERE invoice_id = ? ORDER BY date", id);
  const contact = inv.billing_contact_id ? get<any>("SELECT * FROM contacts WHERE id = ?", inv.billing_contact_id) : null;
  const paid = payments.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
  const total = items.length ? items.reduce((s: number, it: any) => s + Math.round(it.quantity * it.unit_amount), 0) : inv.amount;
  const label = invoiceStatusLabel({ status: inv.status, due_date: inv.due_date, amount: total }, paid, today());
  return { inv, items, payments, contact, paid, total, balance: total === null ? null : Math.max(0, total - paid), label, profile: getSetting<any>("profile", {}), settings: getSetting<any>("invoice", {}) };
}

/** Professional single-page invoice. Layout mirrors the on-screen preview. */
export function invoicePdf(id: string): Promise<Buffer> {
  const f = loadInvoice(id);
  if (!f) throw new Error("Invoice not found");
  const { inv, items, payments, contact, paid, total, balance, profile, settings } = f;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 56, info: { Title: `Invoice ${inv.number ?? ""}`, Author: profile.business || profile.name } });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject);
    const INK = "#16140F", MUTE = "#6B665B", LINE = "#D9D4C8", W = doc.page.width - 112;
    doc.fillColor(INK).font("Times-Roman").fontSize(26).text(profile.business || "Nolan On The Run", 56, 56);
    doc.font("Helvetica").fontSize(9).fillColor(MUTE).text([profile.name, profile.email, profile.website, profile.address].filter(Boolean).join("  ·  "), 56, 90, { width: W * 0.6 });
    doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTE).text("INVOICE", 56, 56, { width: W, align: "right", characterSpacing: 2 });
    doc.font("Times-Roman").fontSize(22).fillColor(INK).text(inv.number ?? "Number not recorded", 56, 70, { width: W, align: "right" });
    doc.moveTo(56, 120).lineTo(56 + W, 120).strokeColor(INK).lineWidth(1).stroke();
    const col = (label: string, value: string, x: number, y: number, w = 150) => { doc.font("Helvetica-Bold").fontSize(7.5).fillColor(MUTE).text(label.toUpperCase(), x, y, { width: w, characterSpacing: 1 }); doc.font("Helvetica").fontSize(10).fillColor(INK).text(value, x, y + 12, { width: w }); };
    const billName = inv.bill_to_name || inv.company_name || "Client";
    col("Bill to", [billName, contact?.full_name, inv.bill_to_address, inv.bill_to_email || contact?.email].filter(Boolean).join("\n"), 56, 138, 230);
    col("Issue date", dateLabel(inv.issue_date, { year: true }), 330, 138, 90);
    col("Due date", inv.due_date ? dateLabel(inv.due_date, { year: true }) : "On receipt", 430, 138, 90);
    col("Terms", inv.terms || "—", 330, 184, 90);
    col("Currency", inv.currency, 430, 184, 90);
    let y = 250;
    if (inv.description || inv.deal_name) { col("Project", inv.description || inv.deal_name, 56, y, W); y += 44; }
    doc.moveTo(56, y).lineTo(56 + W, y).strokeColor(LINE).lineWidth(0.75).stroke();
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(MUTE);
    doc.text("DESCRIPTION", 56, y + 8, { characterSpacing: 1 }); doc.text("QTY", 340, y + 8, { width: 40, align: "right", characterSpacing: 1 }); doc.text("RATE", 390, y + 8, { width: 60, align: "right", characterSpacing: 1 }); doc.text("AMOUNT", 460, y + 8, { width: W - 404, align: "right", characterSpacing: 1 });
    y += 26; doc.moveTo(56, y).lineTo(56 + W, y).stroke();
    doc.font("Helvetica").fontSize(10).fillColor(INK);
    for (const it of items) {
      const h = doc.heightOfString(it.description, { width: 270 });
      doc.text(it.description, 56, y + 8, { width: 270 });
      doc.text(String(it.quantity), 340, y + 8, { width: 40, align: "right" }); doc.text(money(it.unit_amount, inv.currency, { cents: true }), 390, y + 8, { width: 60, align: "right" }); doc.text(money(Math.round(it.quantity * it.unit_amount), inv.currency, { cents: true }), 460, y + 8, { width: W - 404, align: "right" });
      y += Math.max(h, 14) + 16; doc.moveTo(56, y).lineTo(56 + W, y).strokeColor(LINE).stroke();
    }
    y += 14;
    const row = (label: string, value: string, bold = false) => { doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 12 : 10).fillColor(INK).text(label, 330, y, { width: 100 }); doc.text(value, 430, y, { width: W - 374, align: "right" }); y += bold ? 24 : 18; };
    row("Subtotal", money(total, inv.currency, { cents: true }));
    if (paid > 0) row("Paid", `-${money(paid, inv.currency, { cents: true })}`);
    doc.moveTo(330, y - 2).lineTo(56 + W, y - 2).strokeColor(INK).lineWidth(1).stroke(); y += 6;
    row(paid > 0 ? "Balance due" : "Total due", money(balance, inv.currency, { cents: true }), true);
    y += 14;
    if (settings.paymentInfo) { col("Payment information", settings.paymentInfo, 56, y, W * 0.65); y += 20 + doc.heightOfString(settings.paymentInfo, { width: W * 0.65 }) + 10; }
    else { col("Payment information", "Add your bank or payment details in Settings to show them here.", 56, y, W * 0.65); y += 44; }
    if (inv.notes) col("Notes", inv.notes, 56, y, W * 0.8);
    doc.font("Helvetica").fontSize(8).fillColor(MUTE).text(`${profile.business || ""} · ${inv.number ?? ""}`, 56, doc.page.height - 72, { width: W, align: "center" });
    void payments;
    doc.end();
  });
}
