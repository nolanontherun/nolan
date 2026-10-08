import PDFDocument from "pdfkit";
import { all, get, getSetting } from "./db";
import { dateLabel, money } from "./format";
import { invoiceStatusLabel } from "./calc";
import { today } from "./format";
import { addressLines, brandFrom, currencyName, dueDisplay, isReceipt, longDate, splitItem } from "./invoice-mail";

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

/** Warm, single-page invoice. The on-screen preview on the invoice page mirrors this layout. */
export function invoicePdf(id: string): Promise<Buffer> {
  const f = loadInvoice(id);
  if (!f) throw new Error("Invoice not found");
  const { inv, items, contact, paid, total, balance, profile, settings } = f;
  const brand = brandFrom(profile);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 0, bufferPages: true, info: { Title: `Invoice ${inv.number ?? ""}`, Author: brand.legal } });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject);
    const INK = "#2B2722", SOFT = "#6F685D", GOLD = "#B58E55", HAIR = "#E6DCC9", CREAM = "#FBF8F2", BLUSH = "#F3EADB";
    const PW = doc.page.width, PH = doc.page.height, M = 64, W = PW - M * 2, CX = PW / 2;
    const paint = () => { doc.rect(0, 0, PW, PH).fill(CREAM); doc.rect(18, 18, PW - 36, PH - 36).lineWidth(0.7).strokeColor(HAIR).stroke(); };
    const cap = (t: string, x: number, y: number, w: number, align: "left" | "center" | "right" = "left") => doc.font("Helvetica").fontSize(7.5).fillColor(GOLD).text(t.toUpperCase(), x, y, { width: w, align, characterSpacing: 2 });
    const txt = (t: string, x: number, y: number, w: number, o: { size?: number; font?: string; color?: string; align?: "left" | "center" | "right"; gap?: number } = {}) =>
      doc.font(o.font ?? "Helvetica").fontSize(o.size ?? 10).fillColor(o.color ?? INK).text(t, x, y, { width: w, align: o.align ?? "left", lineGap: o.gap ?? 3 });
    const rule = (y: number, x1 = M, x2 = M + W) => doc.moveTo(x1, y).lineTo(x2, y).lineWidth(0.6).strokeColor(HAIR).stroke();
    const mark = (y: number) => doc.moveTo(CX - 28, y).lineTo(CX + 28, y).lineWidth(0.8).strokeColor(GOLD).stroke();
    const cur = inv.currency || "USD";
    const due = dueDisplay(inv.terms, inv.due_date);
    paint();

    cap(brand.production || "Invoice", 0, 62, PW, "center");
    txt(brand.legal, 0, 80, PW, { size: brand.legal.length > 24 ? 28 : 32, font: "Times-Roman", align: "center" });
    mark(128);
    txt("Invoice", 0, 140, PW, { size: 15, font: "Times-Italic", color: SOFT, align: "center" });

    let y = 178; const colW = W / 3;
    const meta = (l: string, v: string, n: number) => { cap(l, M + colW * n, y, colW, "center"); txt(v, M + colW * n, y + 14, colW, { size: 11, font: "Times-Roman", align: "center" }); };
    meta("Invoice no.", inv.number ?? "—", 0); meta("Issued", longDate(inv.issue_date) || "—", 1); meta("Due", due, 2);
    rule(y + 42);

    y = 242;
    const billName = inv.bill_to_name || contact?.full_name || inv.company_name || "Client";
    const billLines = [inv.bill_to_email || contact?.email, contact?.phone, inv.bill_to_address].filter(Boolean).join("\n");
    cap("Prepared for", M, y, 220);
    txt(billName, M, y + 15, 230, { size: 15, font: "Times-Roman" });
    if (billLines) txt(billLines, M, y + 38, 230, { size: 9.5, color: SOFT });
    cap("From", M + 290, y, 200);
    txt(brand.legal, M + 290, y + 15, 230, { size: 15, font: "Times-Roman" });
    txt([...addressLines(brand.address), brand.email].join("\n"), M + 290, y + 38, 230, { size: 9.5, color: SOFT });

    y = 344;
    if (inv.description) { cap("Project", M, y - 4, W); txt(inv.description, M, y + 10, W, { size: 13, font: "Times-Roman" }); y += 46; }
    doc.rect(M, y, W, 26).fill(BLUSH);
    cap("Description", M + 16, y + 9, 250); cap("Amount", M + W - 116, y + 9, 100, "right");
    y += 26;
    const rows = items.length ? items.map((it: any) => ({ ...splitItem(it.description), qty: it.quantity, rate: it.unit_amount, amount: Math.round(it.quantity * it.unit_amount) })) : [{ title: inv.description ?? "Services", detail: "", qty: 1, rate: total ?? 0, amount: total ?? 0 }];
    for (const r of rows) {
      const detail = [r.detail, r.qty !== 1 ? `${r.qty} × ${money(r.rate, cur, { cents: true })}` : ""].filter(Boolean).join("  ·  ");
      const h = detail ? 70 : 50;
      if (y + h > PH - 190) { doc.addPage(); paint(); y = 64; }
      txt(r.title, M + 16, y + 18, 340, { size: 14, font: "Times-Roman" });
      if (detail) txt(detail, M + 16, y + 40, 340, { size: 9.5, color: SOFT });
      txt(money(r.amount, cur, { cents: true }), M + W - 160, y + 20, 144, { size: 13, align: "right" });
      y += h; rule(y);
    }

    y += 24;
    if (paid > 0) { cap("Paid", M, y, 200); txt(`−${money(paid, cur, { cents: true })}`, M + W - 260, y - 3, 260, { size: 13, align: "right", color: SOFT }); y += 28; }
    cap(paid > 0 ? "Balance due" : "Total due", M, y + 6, 200);
    txt(money(balance, cur, { cents: true }), M + W - 260, y - 4, 260, { size: 30, font: "Times-Roman", align: "right" });
    txt(`${currencyName(cur)}  ·  ${isReceipt(inv.terms) ? "due on receipt" : `due ${due}`}`, M + W - 260, y + 34, 260, { size: 9, color: SOFT, align: "right" });
    y += 60; mark(y);
    y += 36;
    txt(inv.notes || "Thank you for trusting me.", M + 20, y, W - 40, { size: 18, font: "Times-Italic", align: "center" });

    y = Math.max(646, y + 70);
    if (y > PH - 120) { doc.addPage(); paint(); y = 64; }
    rule(y);
    cap("Payment", M, y + 16, 200);
    txt(settings.paymentInfo || "I'll send the payment details by email.", M, y + 31, 250, { size: 9.5, color: SOFT });
    cap("Questions", M + 290, y + 16, 200);
    txt(`${brand.email}\nI'm happy to help with anything.`, M + 290, y + 31, 220, { size: 9.5, color: SOFT });

    const range = doc.bufferedPageRange();
    for (let n = 0; n < range.count; n++) {
      doc.switchToPage(n);
      doc.font("Helvetica").fontSize(7.5).fillColor(SOFT).text([brand.legal, brand.production, brand.address.split(/,\s*/).slice(-2).join(", ")].filter(Boolean).join("  ·  ") + (range.count > 1 ? `  ·  ${n + 1}/${range.count}` : ""), 0, PH - 50, { width: PW, align: "center", lineBreak: false });
    }
    doc.end();
  });
}
