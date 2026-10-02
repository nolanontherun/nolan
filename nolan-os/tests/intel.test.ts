import test from "node:test";
import assert from "node:assert/strict";
import { classifyEmail, detectPaymentPromise, extractDeal, suspiciousSignals, threadFollowUp } from "../src/lib/intel";
import { dealFinance, gross, profitability, termsDays } from "../src/lib/calc";
import { money, parseMoney } from "../src/lib/format";

test("extracts the example offer without finalising it", () => {
  const r = extractDeal("Would love to offer $5,000 for one Instagram Reel, 30 days paid usage. Payment net 30.");
  const offer = r.facts.find((f) => f.key === "offer")!;
  assert.equal(offer.amount, 500000);
  assert.equal(offer.certainty, "FACT");
  assert.ok(r.facts.some((f) => f.key === "deliverable" && f.value.includes("Reel")));
  assert.ok(r.facts.some((f) => f.key === "usage:paid" && f.value === "30 days"));
  assert.ok(r.facts.some((f) => f.key === "payment_terms" && f.value === "Net 30"));
  assert.match(r.summary, /AI detected/);
});
test("hedged budgets stay inference", () => {
  const f = extractDeal("We can probably do around $10k for this.").facts.find((x) => x.key === "offer")!;
  assert.equal(f.amount, 1000000);
  assert.equal(f.certainty, "INFERENCE");
});
test("payment promise is detected", () => {
  assert.ok(detectPaymentPromise("Finance will take care of this next week."));
  assert.ok(detectPaymentPromise("We anticipate you will receive the funds this week."));
  assert.equal(detectPaymentPromise("Thanks for the video, looks great."), null);
});
test("suspicious signals are conservative", () => {
  const s = suspiciousSignals({ from: "Brand <deals@gmail.com>", body: "Pay a $200 registration fee first. Buy gift cards. Urgent!", claimedCompany: "Nike" });
  assert.equal(s.level, "suspicious");
  assert.ok(s.reasons.length >= 3);
  assert.equal(suspiciousSignals({ from: "a@sony.com", body: "Can you send your rates for a Reel?", claimedCompany: "Sony" }).level, "none");
});
test("classifies leads and newsletters", () => {
  assert.equal(classifyEmail({ from: "a@brand.com", body: "We'd love to work with you. Can you send your rates?" }).klass, "New Lead");
  assert.equal(classifyEmail({ from: "no-reply@x.com", body: "Weekly digest. Unsubscribe here." }).priority, "Ignore");
});
test("thread follow-up windows", () => {
  const t = "2026-10-02";
  assert.deepEqual(threadFollowUp([{ date: "2026-09-28", direction: "in", classification: "New Lead" }], t), { kind: "needs_reply", days: 4 });
  assert.equal(threadFollowUp([{ date: "2024-01-01", direction: "in", classification: "New Lead" }], t), null);
  assert.equal(threadFollowUp([{ date: "2026-10-01", direction: "in", classification: "New Lead" }], t), null);
});
test("finance: unknown stays unknown, no cross-currency maths", () => {
  const d: any = { id: "x", currency: "USD", final_amount: 50000, usage_fee: null, exclusivity_fee: null, whitelisting_fee: null, licensing_fee: null, affiliate_commission: null, payment_state: "partial", manual_outstanding: null, manual_outstanding_currency: null, stage: "Paid" };
  const f = dealFinance(d, [{ deal_id: "x", amount: 39952, currency: "EUR", date: "2024-11-09" }], []);
  assert.equal(f.paidSameCurrency, 0);
  assert.equal(f.outstanding?.amount, 50000);
  assert.equal(gross({ ...d, final_amount: null }), null);
  assert.equal(dealFinance({ ...d, final_amount: null }, [], []).outstanding?.amount, null);
  assert.equal(profitability(100000, []), null);
  const p = profitability(1500000, [{ label: "DP", amount: 100000 }, { label: "Travel", amount: 60000 }, { label: "Talent", amount: 50000 }, { label: "Production", amount: 30000 }])!;
  assert.equal(p.profit, 1260000);
  assert.equal(Math.round(p.margin! * 100), 84);
});
test("money helpers", () => {
  assert.equal(parseMoney("$5,000"), 500000);
  assert.equal(parseMoney("5k"), 500000);
  assert.equal(parseMoney(""), null);
  assert.equal(money(null), "Not recorded");
  assert.equal(money(39952, "EUR"), "€399.52");
  assert.equal(termsDays("Net 60"), 60);
});
