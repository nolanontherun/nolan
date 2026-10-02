import { cache } from "react";
import { all, get, getSetting } from "./db";
import { loadDeals, companyRows, bestValue } from "./queries";
import { threadFollowUp } from "./intel";
import { addDays, daysBetween, daysFromToday, money, moneyMap, today, dateLabel, relDays, plural } from "./format";
import { addMoney } from "./calc";

export type Severity = "critical" | "high" | "medium" | "low";
export type AttentionItem = {
  key: string; group: string; severity: Severity; title: string; detail: string; href: string; amount?: string; days?: number | null; actions: ("handled" | "snooze" | "ignore" | "task" | "open")[];
  meta?: Record<string, string>;
};

export const GROUPS: { id: string; label: string; tone: "bad" | "warn" | "mute" }[] = [
  { id: "payment", label: "Overdue invoices and unpaid work", tone: "bad" },
  { id: "promise", label: "Payment promises", tone: "warn" },
  { id: "followup", label: "Follow-ups", tone: "warn" },
  { id: "contract", label: "Contracts waiting", tone: "warn" },
  { id: "lead", label: "New potential clients", tone: "warn" },
  { id: "unanswered", label: "Emails waiting on you or them", tone: "warn" },
  { id: "usage", label: "Usage rights expiring", tone: "warn" },
  { id: "exclusivity", label: "Exclusivity expiring", tone: "warn" },
  { id: "deadline", label: "Upcoming deadlines", tone: "warn" },
  { id: "suspicious", label: "Possibly suspicious", tone: "mute" },
  { id: "dormant", label: "Quiet relationships", tone: "mute" },
  { id: "confirm", label: "Needs confirmation", tone: "mute" },
];

type Beh = { dormantMonths: number; replyDays: number; chaseDays: number; contractDays: number; usageWarnDays: number; exclusivityWarnDays: number; highValueUSD: number };

export const getAttention = cache(function getAttentionImpl(): AttentionItem[] {
  const opts: { includeHidden?: boolean } = {};
  const t = today();
  const beh = getSetting<Beh>("behaviour", { dormantMonths: 6, replyDays: 2, chaseDays: 5, contractDays: 3, usageWarnDays: 30, exclusivityWarnDays: 30, highValueUSD: 5000 });
  const states = new Map(all<{ key: string; state: string; until: string | null }>("SELECT key, state, until FROM attention_state").map((s) => [s.key, s]));
  const items: AttentionItem[] = [];
  const deals = loadDeals();

  // payments: unpaid / overdue
  for (const d of deals) {
    const o = d.fin.outstanding;
    if (!o) continue;
    const amountTxt = o.amount === null ? "Amount not recorded" : money(o.amount, o.currency);
    const dueIn = d.invoice_due ? daysFromToday(d.invoice_due) : null;
    let sev: Severity = "medium"; let detail: string; let title: string;
    if (dueIn !== null && dueIn < 0) { sev = -dueIn >= 30 ? "critical" : "high"; title = `${d.company_name ?? d.name}: ${amountTxt} overdue ${plural(-dueIn, "day")}`; detail = `Due ${dateLabel(d.invoice_due, { year: true })}${d.payment_terms ? ` (${d.payment_terms})` : ""}.`; }
    else if (dueIn !== null && dueIn <= 7) { sev = "high"; title = `${d.company_name ?? d.name}: ${amountTxt} due ${relDays(dueIn)}`; detail = `Due ${dateLabel(d.invoice_due, { year: true })}.`; }
    else if (dueIn !== null) continue;
    else { title = `${d.company_name ?? d.name}: ${amountTxt} unpaid`; detail = d.fin.outstanding?.basis === "stated" ? (d.manual_outstanding_note ?? "Amount stated on your Figma board.") : "No invoice or due date recorded, so no overdue date can be calculated."; if (d.payment_state === "partial") detail = "Partly paid. " + detail; }
    items.push({ key: `pay:${d.id}`, group: "payment", severity: sev, title, detail, href: `/deals/${d.id}`, amount: amountTxt, days: d.days_outstanding, actions: ["open", "handled", "snooze", "ignore", "task"] });
  }

  // payment promises
  for (const p of all<any>("SELECT p.*, d.name dname, d.company_id FROM payment_promises p LEFT JOIN deals d ON d.id = p.deal_id WHERE p.status = 'open'")) {
    items.push({ key: `promise:${p.id}`, group: "promise", severity: "medium", title: `Payment promised: ${p.dname ?? "unlinked deal"}`, detail: `${p.claimed_date ? `Claimed ${p.claimed_date}. ` : ""}Promise from ${dateLabel(p.date, { year: true })}. Still unpaid until you confirm it.`, href: p.deal_id ? `/deals/${p.deal_id}` : "/inbox", actions: ["open", "handled", "snooze"] });
  }

  // follow-ups: dated tasks and deal follow-up dates
  let undated = 0;
  for (const k of all<any>("SELECT t.*, d.name dname FROM tasks t LEFT JOIN deals d ON d.id = t.deal_id WHERE t.status = 'open' AND (t.snoozed_until IS NULL OR t.snoozed_until <= ?)", t)) {
    if (!k.due_date) { undated++; continue; }
    const n = daysFromToday(k.due_date)!;
    if (n > 7) continue;
    items.push({ key: `task:${k.id}`, group: "followup", severity: n < 0 ? "high" : "medium", title: k.title, detail: `${k.dname ? k.dname + ". " : ""}Due ${n < 0 ? `${-n} days ago` : relDays(n)}.`, href: k.deal_id ? `/deals/${k.deal_id}` : "/tasks", days: n, actions: ["open", "handled", "snooze", "ignore"] });
  }
  for (const d of deals) if (d.next_followup && d.next_followup <= addDays(t, 7) && !["Paid", "Lost", "Archived"].includes(d.stage)) {
    const n = daysFromToday(d.next_followup)!;
    items.push({ key: `fu:${d.id}`, group: "followup", severity: n < 0 ? "high" : "medium", title: `Follow up: ${d.company_name ?? d.name}`, detail: `${d.next_action ?? "Follow-up"} · ${n < 0 ? `${-n} days overdue` : relDays(n)}`, href: `/deals/${d.id}`, days: n, actions: ["open", "handled", "snooze", "ignore"] });
  }
  if (undated) items.push({ key: "tasks:undated", group: "followup", severity: "low", title: `${plural(undated, "open follow-up")} without a date`, detail: "Imported next actions have no due date. Add dates so they surface here.", href: "/tasks?filter=undated", actions: ["open", "ignore"] });

  // contracts waiting
  for (const d of deals) if (d.stage === "Contract sent") {
    const since = d.contract_date ?? d.updated_at?.slice(0, 10) ?? t;
    const age = daysBetween(since, t);
    if (age >= beh.contractDays) items.push({ key: `contract:${d.id}`, group: "contract", severity: "high", title: `${d.company_name ?? d.name}: contract sent ${age} days ago`, detail: "Waiting for signature.", href: `/deals/${d.id}`, days: age, actions: ["open", "handled", "snooze"] });
  }

  // new leads needing review
  for (const r of all<any>("SELECT * FROM review_queue WHERE status = 'needs_review' ORDER BY received DESC")) {
    items.push({ key: `lead:${r.id}`, group: "lead", severity: r.potential_budget && r.potential_budget >= beh.highValueUSD * 100 ? "high" : "medium", title: `New potential client: ${r.company_name ?? "Unknown company"}`, detail: `${r.summary ?? ""}${r.potential_budget ? ` · Potential budget ${money(r.potential_budget, r.budget_currency ?? "USD")} (${r.budget_status ?? "unconfirmed"})` : ""}`, href: "/inbox?tab=review", amount: r.potential_budget ? money(r.potential_budget, r.budget_currency ?? "USD") : undefined, actions: ["open", "ignore"] });
  }

  // email threads
  const comms = all<any>("SELECT * FROM communications WHERE date IS NOT NULL AND thread_id IS NOT NULL AND thread_id != '(Gmail)' AND handled = 0 ORDER BY date");
  const threads = new Map<string, any[]>();
  for (const c of comms) (threads.get(c.thread_id) ?? threads.set(c.thread_id, []).get(c.thread_id)!).push(c);
  for (const [id, msgs] of threads) {
    const f = threadFollowUp(msgs.map((m) => ({ date: m.date, direction: m.direction, classification: m.classification })), t, { replyDays: beh.replyDays, chaseDays: beh.chaseDays });
    if (!f) continue;
    const last = msgs[msgs.length - 1];
    items.push({ key: `thread:${id}`, group: "unanswered", severity: f.kind === "needs_reply" ? "high" : "medium", title: f.kind === "needs_reply" ? `Needs your reply: ${last.subject}` : `Waiting on ${last.company_name ?? "them"}: ${last.subject}`, detail: `${f.kind === "needs_reply" ? "They wrote" : "You wrote"} ${f.days} days ago.`, href: last.deal_id ? `/deals/${last.deal_id}` : "/inbox", days: f.days, actions: ["open", "handled", "snooze", "ignore", "task"] });
  }

  // usage + exclusivity
  for (const u of all<any>("SELECT u.*, d.name dname, c.name cname FROM usage_rights u JOIN deals d ON d.id=u.deal_id LEFT JOIN companies c ON c.id=d.company_id WHERE u.end_date IS NOT NULL")) {
    const n = daysFromToday(u.end_date)!;
    if (n > beh.usageWarnDays || n < -7) continue;
    items.push({ key: `usage:${u.id}`, group: "usage", severity: n <= 7 ? "high" : "medium", title: `${u.kind} for ${u.cname ?? u.dname} ${n < 0 ? `expired ${-n} days ago` : n === 0 ? "expires today" : `expires in ${plural(n, "day")}`}`, detail: `Ends ${dateLabel(u.end_date, { year: true })}${u.platforms ? ` · ${u.platforms}` : ""}${u.territory ? ` · ${u.territory}` : ""}`, href: `/deals/${u.deal_id}`, days: n, actions: ["open", "handled", "snooze"] });
  }
  for (const x of all<any>("SELECT x.*, d.name dname, c.name cname FROM exclusivity x JOIN deals d ON d.id=x.deal_id LEFT JOIN companies c ON c.id=d.company_id WHERE x.end_date IS NOT NULL")) {
    const n = daysFromToday(x.end_date)!;
    if (n > beh.exclusivityWarnDays || n < -7) continue;
    items.push({ key: `excl:${x.id}`, group: "exclusivity", severity: "medium", title: `${x.competitor_category ?? "Category"} exclusivity with ${x.cname ?? x.dname} ${n < 0 ? `ended ${-n} days ago` : `ends in ${plural(n, "day")}`}`, detail: `Ends ${dateLabel(x.end_date, { year: true })}`, href: `/deals/${x.deal_id}`, days: n, actions: ["open", "handled", "snooze"] });
  }

  // deadlines
  for (const v of all<any>("SELECT v.*, d.name dname, c.name cname FROM deliverables v JOIN deals d ON d.id=v.deal_id LEFT JOIN companies c ON c.id=d.company_id WHERE v.deadline IS NOT NULL AND v.status NOT IN ('Delivered','Published')")) {
    const n = daysFromToday(v.deadline)!;
    if (n > 7) continue;
    if (n < -30) { items.push({ key: `deadline:${v.id}`, group: "confirm", severity: "low", title: `${v.cname ?? v.dname}: deadline passed ${dateLabel(v.deadline, { year: true })} and the status is still ${v.status}`, detail: "Update the deliverable status, or delete the deadline if it no longer applies.", href: `/deals/${v.deal_id}`, days: n, actions: ["open", "handled", "ignore"] }); continue; }
    items.push({ key: `deadline:${v.id}`, group: "deadline", severity: n < 0 ? "high" : n <= 2 ? "high" : "medium", title: `${v.cname ?? v.dname}: ${[v.platform, v.content_type].filter(Boolean).join(" ") || "deliverable"} due ${n < 0 ? `${-n} days ago` : relDays(n)}`, detail: `Deadline ${dateLabel(v.deadline, { year: true })}`, href: `/deals/${v.deal_id}`, days: n, actions: ["open", "handled", "snooze"] });
  }

  // suspicious
  for (const c of all<any>("SELECT * FROM communications WHERE classification = 'Suspicious' AND handled = 0")) {
    items.push({ key: `sus:${c.id}`, group: "suspicious", severity: "medium", title: `Possibly suspicious: ${c.subject ?? c.sender}`, detail: (c.suspicious_reasons ? JSON.parse(c.suspicious_reasons)[0] : "Flagged for review."), href: "/inbox?tab=suspicious", actions: ["open", "handled", "ignore"] });
  }

  // dormant (factual only)
  const cutoff = beh.dormantMonths * 30;
  const dormant = companyRows().filter((c) => c.dealCount > 0 && Object.keys(c.lifetime).length).map((c) => {
    const last = [c.last, c.lastComm].filter(Boolean).sort().pop()!;
    return { c, last, age: last ? daysBetween(last.slice(0, 10), t) : 0 };
  }).filter((x) => x.last && x.age >= cutoff && x.c.active === 0).sort((a, b) => (Object.values(b.c.lifetime) as number[]).reduce((s, v) => s + v, 0) - (Object.values(a.c.lifetime) as number[]).reduce((s, v) => s + v, 0)).slice(0, 5);
  for (const x of dormant) items.push({ key: `dormant:${x.c.id}`, group: "dormant", severity: "low", title: `${x.c.name}: no business activity recorded for ${Math.floor(x.age / 30)} months`, detail: `Last activity ${dateLabel(x.last.slice(0, 10), { year: true })}. Lifetime ${moneyMap(x.c.lifetime)}.`, href: `/companies/${x.c.id}`, days: x.age, actions: ["open", "ignore"] });

  // needs confirmation
  const presumed = deals.filter((d) => d.payment_state === "presumed_paid");
  if (presumed.length) items.push({ key: "confirm:presumed", group: "confirm", severity: "low", title: `${plural(presumed.length, "deal")} counted as paid without proof`, detail: "The Figma board showed them as done with no unpaid flag. Confirm the payment and add the date.", href: "/quality", actions: ["open", "ignore"] });
  const amt = deals.filter((d) => !d.final_amount && ["Paid"].includes(d.stage));
  if (amt.length) items.push({ key: "confirm:amounts", group: "confirm", severity: "low", title: `${plural(amt.length, "paid deal")} with no amount recorded`, detail: "Amounts were not in the sources. They stay as Not recorded until you enter them.", href: "/quality", actions: ["open", "ignore"] });

  const order = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  const visible = items.filter((i) => {
    if (opts.includeHidden) return true;
    const s = states.get(i.key);
    if (!s) return true;
    if (s.state === "snoozed" && s.until && s.until > t) return false;
    if (s.state === "snoozed") return true;
    return false;
  });
  return visible.sort((a, b) => order[a.severity] - order[b.severity] || (a.days ?? 0) - (b.days ?? 0));
});

export function attentionCounts(items = getAttention()) {
  const by: Record<string, number> = {};
  for (const i of items) by[i.group] = (by[i.group] ?? 0) + 1;
  return { total: items.length, urgent: items.filter((i) => i.severity === "critical" || i.severity === "high").length, by };
}

// ---------------------------------------------------------------- upcoming (next 30 days)
export function upcoming() {
  const t = today();
  const end = addDays(t, 30);
  const ev: { date: string; kind: string; label: string; href: string }[] = [];
  for (const v of all<any>("SELECT v.*, d.name dname, c.name cname FROM deliverables v JOIN deals d ON d.id=v.deal_id LEFT JOIN companies c ON c.id=d.company_id WHERE v.deadline BETWEEN ? AND ? AND v.status NOT IN ('Delivered','Published')", t, end))
    ev.push({ date: v.deadline, kind: "Deadline", label: `${v.cname ?? v.dname}: ${[v.platform, v.content_type].filter(Boolean).join(" ")}`, href: `/deals/${v.deal_id}` });
  for (const d of loadDeals()) {
    if (d.posting_date && d.posting_date >= t && d.posting_date <= end && !["Paid", "Lost"].includes(d.stage)) ev.push({ date: d.posting_date, kind: "Posting", label: d.name, href: `/deals/${d.id}` });
    if (d.invoice_due && d.invoice_due >= t && d.invoice_due <= end && d.fin.outstanding) ev.push({ date: d.invoice_due, kind: "Invoice due", label: d.name, href: `/deals/${d.id}` });
    if (d.next_followup && d.next_followup >= t && d.next_followup <= end) ev.push({ date: d.next_followup, kind: "Follow-up", label: `${d.company_name}: ${d.next_action ?? ""}`, href: `/deals/${d.id}` });
  }
  for (const u of all<any>("SELECT u.*, d.name dname FROM usage_rights u JOIN deals d ON d.id=u.deal_id WHERE u.end_date BETWEEN ? AND ?", t, end)) ev.push({ date: u.end_date, kind: "Usage ends", label: `${u.kind}: ${u.dname}`, href: `/deals/${u.deal_id}` });
  for (const x of all<any>("SELECT x.*, d.name dname FROM exclusivity x JOIN deals d ON d.id=x.deal_id WHERE x.end_date BETWEEN ? AND ?", t, end)) ev.push({ date: x.end_date, kind: "Exclusivity ends", label: `${x.competitor_category ?? ""}: ${x.dname}`, href: `/deals/${x.deal_id}` });
  for (const k of all<any>("SELECT * FROM tasks WHERE status='open' AND due_date BETWEEN ? AND ?", t, end)) ev.push({ date: k.due_date, kind: "Task", label: k.title, href: k.deal_id ? `/deals/${k.deal_id}` : "/tasks" });
  return ev.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------- exclusivity conflicts
export function exclusivityConflicts(input: { category?: string | null; competitor?: string | null; start?: string | null; end?: string | null; excludeDealId?: string }) {
  const t = today();
  const rows = all<any>("SELECT x.*, d.name dname, c.name cname FROM exclusivity x JOIN deals d ON d.id=x.deal_id LEFT JOIN companies c ON c.id=d.company_id WHERE x.end_date IS NULL OR x.end_date >= ?", t);
  const norm = (s?: string | null) => (s ?? "").toLowerCase();
  return rows.filter((x) => {
    if (input.excludeDealId && x.deal_id === input.excludeDealId) return false;
    const catHit = input.category && x.competitor_category && (norm(x.competitor_category).includes(norm(input.category)) || norm(input.category).includes(norm(x.competitor_category)));
    const compHit = input.competitor && norm(x.competitors).includes(norm(input.competitor));
    if (!catHit && !compHit) return false;
    const s = input.start ?? t, e = input.end ?? "9999-12-31";
    return (x.start_date ?? "0000") <= e && (x.end_date ?? "9999") >= s;
  }).map((x) => ({ id: x.id, deal_id: x.deal_id, text: `Potential exclusivity conflict: active ${x.competitor_category ?? "category"} exclusivity with ${x.cname ?? x.dname}${x.end_date ? ` through ${dateLabel(x.end_date, { year: true })}` : " (no end date recorded)"}.` }));
}

// ---------------------------------------------------------------- briefs
export function dailyBrief() {
  const items = getAttention();
  const t = today();
  const deals = loadDeals();
  const out: Record<string, number> = {}; let outCount = 0;
  const due: Record<string, number> = {};
  for (const d of deals) if (d.fin.outstanding?.amount) { addMoney(out, d.fin.outstanding.currency, d.fin.outstanding.amount); outCount++; if (d.invoice_due && d.invoice_due <= addDays(t, 7)) addMoney(due, d.fin.outstanding.currency, d.fin.outstanding.amount); }
  const g = (id: string) => items.filter((i) => i.group === id).length;
  return {
    needsReply: items.filter((i) => i.key.startsWith("thread:") && i.title.startsWith("Needs your reply")).length,
    followups: g("followup"), outstanding: out, outstandingCount: outCount, paymentsDue: due, newOpportunities: g("lead"), contracts: g("contract"), usageExpiring: g("usage") + g("exclusivity"), suspicious: g("suspicious"), items,
  };
}

export function weeklyBrief() {
  const t = today(); const from = addDays(t, -7);
  const deals = loadDeals();
  const created = all<any>("SELECT * FROM deals WHERE created_at >= ? AND source NOT LIKE '%spreadsheet%' AND source NOT LIKE '%figma%'", from + " 00:00:00");
  const won = all<any>("SELECT COUNT(*) c FROM activity_log WHERE kind='stage' AND at >= ? AND summary LIKE '%Agreed%'", from)[0].c;
  const lost = all<any>("SELECT COUNT(*) c FROM activity_log WHERE kind='stage' AND at >= ? AND summary LIKE '%Lost%'", from)[0].c;
  const paid: Record<string, number> = {};
  for (const p of all<any>("SELECT amount, currency FROM payments WHERE date >= ? AND date <= ?", from, t)) addMoney(paid, p.currency, p.amount);
  const booked: Record<string, number> = {};
  for (const l of all<any>("SELECT d.final_amount a, d.currency c FROM activity_log l JOIN deals d ON d.id = l.entity_id WHERE l.kind='stage' AND l.at >= ? AND l.summary LIKE '%Agreed%'", from)) addMoney(booked, l.c, l.a);
  const att = getAttention();
  return { from, to: t, newLeads: all<any>("SELECT COUNT(*) c FROM review_queue WHERE created_at >= ?", from + " 00:00:00")[0].c, newDeals: created.length, won, lost, booked, paid, outstanding: att.filter((i) => i.group === "payment").length, overdue: att.filter((i) => i.group === "payment" && i.severity !== "medium").length, followupsMissed: att.filter((i) => i.group === "followup" && i.severity === "high").length, deadlines: att.filter((i) => i.group === "deadline").length, usage: att.filter((i) => i.group === "usage").length, exclusivity: att.filter((i) => i.group === "exclusivity").length, highValue: deals.filter((d) => ["Lead", "Contacted", "Negotiating", "Proposal sent"].includes(d.stage) && (bestValue(d) ?? 0) >= 500000).map((d) => ({ id: d.id, name: d.name, value: money(bestValue(d), d.currency) })), dormant: att.filter((i) => i.group === "dormant") };
}
