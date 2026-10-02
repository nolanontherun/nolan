// Pure finance helpers. No DB access; everything derives from stored rows.
export type DealRow = {
  id: string; currency: string; final_amount: number | null; usage_fee: number | null; exclusivity_fee: number | null; whitelisting_fee: number | null;
  licensing_fee: number | null; affiliate_commission: number | null; payment_state: string | null; manual_outstanding: number | null;
  manual_outstanding_currency: string | null; stage: string; product_value?: number | null;
};
export type PaymentRow = { deal_id: string | null; amount: number | null; currency: string; date: string | null };
export type ExpenseRow = { deal_id: string | null; amount: number | null; currency: string };

export type Outstanding = { amount: number | null; currency: string; basis: "computed" | "stated" | "unknown" } | null;

export type DealFinance = {
  gross: number | null;
  paid: Record<string, number>;
  paidSameCurrency: number;
  unknownAmountPayments: number;
  outstanding: Outstanding;
  recognized: Record<string, number>; // revenue we count as received
  unverified: Record<string, number>; // portion of recognized that is only presumed
  expenses: number; // same currency as deal
  net: number | null;
};

export function gross(d: DealRow): number | null {
  const parts = [d.final_amount, d.usage_fee, d.exclusivity_fee, d.whitelisting_fee, d.licensing_fee, d.affiliate_commission];
  if (parts.every((p) => p === null || p === undefined)) return null;
  return parts.reduce<number>((s, p) => s + (p ?? 0), 0);
}

export function dealFinance(d: DealRow, payments: PaymentRow[], expenses: ExpenseRow[]): DealFinance {
  const g = gross(d);
  const paid: Record<string, number> = {};
  let unknownAmountPayments = 0;
  for (const p of payments) {
    if (p.amount === null) { unknownAmountPayments++; continue; }
    paid[p.currency] = (paid[p.currency] ?? 0) + p.amount;
  }
  const paidSame = paid[d.currency] ?? 0;
  let outstanding: Outstanding = null;
  const open = d.payment_state === "unpaid" || d.payment_state === "partial";
  if (d.manual_outstanding !== null && d.manual_outstanding !== undefined && open) {
    outstanding = { amount: d.manual_outstanding, currency: d.manual_outstanding_currency || d.currency, basis: "stated" };
  } else if (open) {
    outstanding = g === null ? { amount: null, currency: d.currency, basis: "unknown" } : { amount: Math.max(0, g - paidSame), currency: d.currency, basis: "computed" };
    if (outstanding.amount === 0) outstanding = null;
  }
  const recognized: Record<string, number> = {};
  const unverified: Record<string, number> = {};
  if (Object.keys(paid).length) {
    for (const [c, v] of Object.entries(paid)) recognized[c] = v;
  } else if (d.payment_state === "presumed_paid" && g !== null) {
    recognized[d.currency] = g;
    unverified[d.currency] = g;
  }
  const exp = expenses.filter((e) => e.currency === d.currency).reduce((s, e) => s + (e.amount ?? 0), 0);
  const hasExp = expenses.some((e) => e.currency === d.currency && e.amount !== null);
  return { gross: g, paid, paidSameCurrency: paidSame, unknownAmountPayments, outstanding, recognized, unverified, expenses: exp, net: g !== null && hasExp ? g - exp : null };
}

export function addMoney(into: Record<string, number>, currency: string, amount: number | null | undefined) {
  if (amount === null || amount === undefined) return;
  into[currency] = (into[currency] ?? 0) + amount;
}

/** Parse "Net 30", "net30", "30 days" -> 30. */
export function termsDays(terms: string | null | undefined, fallback = 30): number {
  if (!terms) return fallback;
  const m = String(terms).match(/(\d{1,3})/);
  return m ? parseInt(m[1], 10) : fallback;
}

export function invoiceStatusLabel(inv: { status: string; due_date: string | null; amount: number | null }, paid: number, todayISO: string): string {
  if (["Paid", "Void", "Written off", "Disputed", "Draft"].includes(inv.status)) return inv.status;
  if (paid > 0 && inv.amount !== null && paid < inv.amount) return inv.due_date && inv.due_date < todayISO ? "Overdue" : "Partially paid";
  if (inv.due_date) {
    if (inv.due_date < todayISO) return "Overdue";
    if (inv.due_date === todayISO) return "Due today";
    const d = Math.round((Date.parse(inv.due_date) - Date.parse(todayISO)) / 86400000);
    if (d <= 7) return "Due soon";
  }
  return inv.status;
}

/** Profit view. Costs are optional; if none are recorded the profit is unknown, not zero-cost. */
export function profitability(grossAmt: number | null, costs: { label: string; amount: number }[]) {
  const total = costs.reduce((s, c) => s + c.amount, 0);
  if (grossAmt === null || costs.length === 0) return null;
  const profit = grossAmt - total;
  return { gross: grossAmt, costs, totalCosts: total, profit, margin: grossAmt ? profit / grossAmt : null };
}
