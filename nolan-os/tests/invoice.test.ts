import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import nodemailer from "nodemailer";
import { addressLines, brandFrom, buildInvoiceEmail, dueDisplay, joinItem, parseRecipients, resolveDue, splitItem } from "../src/lib/invoice-mail";
import { sendMail, smtpStatus } from "../src/lib/mailer";

const brand = brandFrom({ name: "Nolan Guillou", legalName: "Nolan On The Run LTD", production: "On The Run Production", email: "me@example.com", address: "12 Main Street, Springfield, Ohio, USA" });

test("due options become a date and plain terms", () => {
  assert.deepEqual(resolveDue("receipt", "2026-10-08"), { due: "2026-10-08", terms: "Due on receipt" });
  assert.deepEqual(resolveDue("date", "2026-10-08", { date: "2026-10-31" }), { due: "2026-10-31", terms: "Due October 31, 2026" });
  assert.deepEqual(resolveDue("net", "2026-10-08", { days: 14 }), { due: "2026-10-22", terms: "Net 14" });
  assert.equal(resolveDue("net", "2026-10-08").terms, "Net 30");
  assert.equal(dueDisplay("Due on receipt", "2026-10-08"), "On receipt");
  assert.equal(dueDisplay("Due October 31, 2026", "2026-10-31"), "October 31, 2026");
});
test("invoice line splits into service and detail", () => {
  assert.deepEqual(splitItem(joinItem("Wedding videography", "Havilah Ranch · Oct 31")), { title: "Wedding videography", detail: "Havilah Ranch · Oct 31" });
  assert.deepEqual(splitItem("Just a title"), { title: "Just a title", detail: "" });
});
test("brand falls back sensibly and address wraps in pairs", () => {
  assert.equal(brandFrom({ business: "Acme" }).legal, "Acme");
  assert.equal(brandFrom({}).legal, "Your business name");
  assert.equal(brand.owner, "Nolan");
  assert.deepEqual(addressLines(brand.address), ["12 Main Street, Springfield", "Ohio, USA"]);
});
test("the email names the client, amount, due date and invoice", () => {
  const m = buildInvoiceEmail({ kind: "booking", clientName: "Jae L.", service: "Wedding videography", number: "NTR-2026-001", amount: "$2,000.00", dueText: "October 31, 2026", brand });
  assert.match(m.body, /^Hi Jae,/);
  assert.match(m.body, /\$2,000\.00, due on October 31, 2026/);
  assert.match(m.subject, /NTR-2026-001/);
  assert.match(m.body, /work with you on wedding videography\./);
  assert.match(buildInvoiceEmail({ kind: "invoice", clientName: "A", service: "Instagram Reel", number: "N", amount: "$1", dueText: "On receipt", brand }).body, /for Instagram Reel:/);
  assert.match(m.body, /On The Run Production · Nolan On The Run LTD/);
  const r = buildInvoiceEmail({ kind: "reminder", clientName: null, service: "x", number: "N1", amount: "$1.00", dueText: "On receipt", brand });
  assert.match(r.body, /^Hi there,/);
  assert.match(r.body, /is due on receipt/);
});
test("recipients are validated", () => {
  assert.deepEqual(parseRecipients("a@b.com, c@d.org"), { valid: ["a@b.com", "c@d.org"], invalid: [] });
  assert.deepEqual(parseRecipients("a@b.com nope"), { valid: ["a@b.com"], invalid: ["nope"] });
});
test("smtp status reports what is missing and sending never touches the network in tests", async () => {
  assert.deepEqual(smtpStatus({}).missing, ["NOLAN_SMTP_HOST", "NOLAN_SMTP_USER", "NOLAN_SMTP_PASS"]);
  await assert.rejects(sendMail({ to: ["a@b.com"], subject: "s", text: "t" }, { env: {} }), /not set up/);
  const env = { NOLAN_SMTP_HOST: "h", NOLAN_SMTP_USER: "me@example.com", NOLAN_SMTP_PASS: "p" };
  assert.equal(smtpStatus(env).configured, true);
  const transport = nodemailer.createTransport({ jsonTransport: true });
  let seen: any = null;
  const orig = transport.sendMail.bind(transport);
  (transport as any).sendMail = async (m: any) => { seen = m; return orig(m); };
  await sendMail({ to: ["jae@example.com"], subject: "Hi", text: "Body", replyTo: "me@example.com", attachments: [{ filename: "i.pdf", content: Buffer.from("%PDF"), contentType: "application/pdf" }] }, { env, transport });
  assert.deepEqual(seen.to, ["jae@example.com"]);
  assert.equal(seen.from, "me@example.com");
  assert.equal(seen.attachments[0].filename, "i.pdf");
});
test("the invoice PDF renders from a real database row", async () => {
  process.env.NOLAN_DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "nolan-inv-")), "t.db");
  const { run } = await import("../src/lib/db");
  const { invoicePdf } = await import("../src/lib/invoice");
  run("INSERT INTO contacts (id, full_name, email, phone) VALUES ('c1','Jae L.','jae@example.com','213-536-7769')");
  run("INSERT INTO invoices (id, number, billing_contact_id, issue_date, due_date, amount, currency, status, terms, notes, bill_to_name, bill_to_email) VALUES ('i1','NTR-2026-001','c1','2026-10-08','2026-10-31',200000,'USD','Draft','Due October 31, 2026','Thank you for trusting me.','Jae L.','jae@example.com')");
  run("INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_amount, position) VALUES ('x1','i1','Wedding videography\nHavilah Ranch · October 31, 2026',1,200000,0)");
  const buf = await invoicePdf("i1");
  assert.equal(buf.subarray(0, 4).toString(), "%PDF");
  assert.ok(buf.length > 1500);
});
