import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import { all } from "@/lib/db";
import { loadDeals, contactRows, companyRows } from "@/lib/queries";
import { PageHeader, Section, Badge, Empty } from "@/components/ui";
import { resolveDuplicate } from "@/lib/actions";
import { ConfirmForm } from "@/components/Forms";
import { money, plural } from "@/lib/format";

export const metadata = { title: "Data quality" };
export default function Quality() {
  const dups = all<any>("SELECT * FROM duplicate_reviews WHERE status='open'");
  const decided = all<any>("SELECT * FROM duplicate_reviews WHERE status!='open' ORDER BY decided_at DESC LIMIT 8");
  const deals = loadDeals();
  const gaps = [
    { k: "Counted as paid without proof", href: "/deals?pay=unconfirmed", list: deals.filter((d) => d.payment_state === "presumed_paid"), note: "The Figma board showed these as done with no unpaid flag. Record the payment to confirm." },
    { k: "Payment matched to a receipt by amount only", href: "/deals?pay=unconfirmed", list: deals.filter((d) => d.payment_verification === "receipt-inferred"), note: "The PayPal receipt amount is close to the board amount but not identical (fees). Confirm each match." },
    { k: "Deals with no amount recorded", href: "/deals?pay=noamount", list: deals.filter((d) => d.fin.gross === null && !["Lead", "Negotiating", "Lost"].includes(d.stage)), note: "The amount was not in any source (often the Acos, Props or LV8 payout dashboards)." },
    { k: "Deals with no date at all", href: "/deals", list: deals.filter((d) => !d.deal_date), note: "Without a date they cannot appear in yearly or monthly figures." },
  ];
  const noEmail = contactRows().filter((c) => !c.email).length;
  const invNoAmt = all<any>("SELECT COUNT(*) c FROM invoices WHERE amount IS NULL")[0].c;
  const payNoDate = all<any>("SELECT COUNT(*) c FROM payments WHERE date IS NULL")[0].c;
  const noSize = companyRows().filter((c) => !c.size_range).length;
  let report: any = null;
  try { report = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data-private", "migration_report.json"), "utf8")); } catch {}
  return (
    <div>
      <PageHeader title="Data quality" kicker="Review, never silently merge" sub="Possible duplicates are listed for your decision. Missing information stays visible until you fill it in." />
      <Section title={`Possible duplicates · ${dups.length}`}>
        {dups.length ? <ul className="border-t border-line/10">{dups.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line/[0.07] py-3">
            <div className="min-w-0"><div className="text-[13.5px]"><b>{d.a_name}</b> <span className="text-faint">and</span> <b>{d.b_name}</b></div><div className="text-[12px] text-mute">{d.kind} · {d.reason}</div></div>
            <div className="flex flex-wrap gap-1.5">
              <ConfirmForm action={resolveDuplicate} message={`Merge ${d.b_name} into ${d.a_name}? All linked records move to ${d.a_name}; ${d.b_name} is archived, not deleted.`}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="act" value="merge" /><input type="hidden" name="keep" value="a" /><button className="btn btn-sm">Merge into “{d.a_name.slice(0, 22)}”</button></ConfirmForm>
              <ConfirmForm action={resolveDuplicate} message={`Merge ${d.a_name} into ${d.b_name}? All linked records move to ${d.b_name}; ${d.a_name} is archived, not deleted.`}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="act" value="merge" /><input type="hidden" name="keep" value="b" /><button className="btn btn-sm">Merge into “{d.b_name.slice(0, 22)}”</button></ConfirmForm>
              <form action={resolveDuplicate}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="act" value="keep" /><button className="btn btn-sm btn-ghost">Keep separate</button></form>
              <form action={resolveDuplicate}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="act" value="ignore" /><button className="btn btn-sm btn-ghost">Ignore</button></form>
            </div>
          </li>))}</ul> : <Empty title="No open duplicates">Candidates are found when records share a name or leading word. Decisions are remembered.</Empty>}
        {decided.length > 0 && <p className="mt-3 text-[12px] text-faint">Decided: {decided.map((d) => `${d.a_name} / ${d.b_name} (${d.status.replace("_", " ")})`).join("; ")}</p>}
      </Section>
      <Section title="Missing or unconfirmed information">
        <div className="space-y-6">{gaps.map((g) => (
          <div key={g.k}><div className="flex items-baseline justify-between"><h3 className="text-[14px] font-medium">{g.k} <span className="text-mute">· {g.list.length}</span></h3><Link href={g.href} className="link text-[12px]">Open list</Link></div><p className="text-[12.5px] text-mute">{g.note}</p>{g.list.length > 0 && <p className="mt-1.5 text-[12.5px]">{g.list.slice(0, 8).map((d, i) => <span key={d.id}>{i ? " · " : ""}<Link href={`/deals/${d.id}`} className="hover:text-accent">{d.name}</Link></span>)}{g.list.length > 8 ? ` · and ${g.list.length - 8} more` : ""}</p>}</div>
        ))}
          <div className="grid gap-x-10 gap-y-2 text-[13px] sm:grid-cols-2"><p>{plural(noEmail, "contact")} without an email</p><p>{plural(invNoAmt, "invoice")} without an amount</p><p>{plural(payNoDate, "payment")} without a date</p><p>{plural(noSize, "company", "companies")} without a size range (never guessed)</p></div>
        </div>
      </Section>
      {report && (
        <Section title="Migration report" aside={report.generated_at?.slice(0, 10)}>
          <div className="grid gap-x-12 lg:grid-cols-2">
            <div><div className="caps mb-2">Records created</div><dl className="text-[13px]">{Object.entries(report.records).map(([k, v]) => <div key={k} className="flex justify-between border-b border-line/[0.07] py-1.5"><dt className="capitalize text-mute">{k.replace(/_/g, " ")}</dt><dd className="tabular-nums">{String(v)}</dd></div>)}</dl></div>
            <div><div className="caps mb-2">Sources read</div><dl className="text-[13px]">{Object.entries(report.sources).map(([k, v]) => <div key={k} className="flex justify-between border-b border-line/[0.07] py-1.5"><dt className="capitalize text-mute">{k.replace(/_/g, " ")}</dt><dd className="tabular-nums">{String(v)}</dd></div>)}</dl>
              <div className="caps mb-2 mt-5">Conflicts between sources</div><ul className="space-y-2 text-[12.5px]">{report.reconciliation.conflicts.map((c: any, i: number) => <li key={i}><b>{c.topic}.</b> <span className="text-mute">Sheet: {c.sheet}. Figma: {c.figma}.</span> <span>{c.resolution}.</span></li>)}</ul></div>
          </div>
        </Section>
      )}
    </div>
  );
}
