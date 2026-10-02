import Link from "next/link";
import type { DealX } from "@/lib/queries";
import { Badge, Unknown } from "./ui";
import { STAGE_TONE } from "@/lib/constants";
import { dateLabel, money } from "@/lib/format";

export function PayBadge({ d }: { d: DealX }) {
  const s = d.payment_state;
  if (d.stage === "Lost") return null;
  if (s === "paid") return <Badge tone="good">Paid{d.payment_verification === "receipt-inferred" ? " · matched" : ""}</Badge>;
  if (s === "presumed_paid") return <Badge tone="warn">Paid, unconfirmed</Badge>;
  if (s === "partial") return <Badge tone="warn">Part paid</Badge>;
  if (s === "unpaid") return <Badge tone="bad">Unpaid</Badge>;
  return null;
}

export function Amount({ d }: { d: DealX }) {
  const v = d.fin.gross;
  if (v === null) return <Unknown />;
  return <>{money(v, d.currency)}</>;
}

export function DealTable({ deals, showCompany = true }: { deals: DealX[]; showCompany?: boolean }) {
  if (!deals.length) return null;
  return (
    <>
      <table className="tbl hidden md:table">
        <thead><tr><th>Deal</th><th>Stage</th><th>Payment</th><th className="text-right">Value</th><th>Date</th><th>Via</th></tr></thead>
        <tbody>
          {deals.map((d) => (
            <tr key={d.id}>
              <td className="max-w-[340px]"><Link href={`/deals/${d.id}`} className="font-medium hover:text-accent">{d.name}</Link>{showCompany && d.category && <div className="text-[12px] text-mute">{d.category}</div>}</td>
              <td><Badge tone={STAGE_TONE[d.stage]}>{d.stage}</Badge></td>
              <td><PayBadge d={d} /></td>
              <td className="num"><Amount d={d} /></td>
              <td className="whitespace-nowrap text-mute">{d.deal_date ? dateLabel(d.deal_date, { year: true }) : <Unknown text="Undated" />}</td>
              <td className="text-mute">{d.agency_name ?? "Direct"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="md:hidden">
        {deals.map((d) => (
          <li key={d.id} className="border-b border-line/[0.08] py-3">
            <Link href={`/deals/${d.id}`} className="flex items-start justify-between gap-3">
              <span className="min-w-0"><span className="block truncate text-[14px] font-medium">{d.name}</span><span className="mt-1 flex flex-wrap items-center gap-1.5"><Badge tone={STAGE_TONE[d.stage]}>{d.stage}</Badge><PayBadge d={d} /></span></span>
              <span className="shrink-0 text-right text-[13.5px] tabular-nums"><Amount d={d} /><span className="block text-[11.5px] text-mute">{d.deal_date ? dateLabel(d.deal_date, { year: true }) : "Undated"}</span></span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
