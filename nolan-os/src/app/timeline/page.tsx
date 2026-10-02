import Link from "next/link";
import { loadDeals } from "@/lib/queries";
import { PageHeader, Badge, Unknown } from "@/components/ui";
import { dateLabel, money, moneyMap } from "@/lib/format";
import { STAGE_TONE } from "@/lib/constants";
import { addMoney } from "@/lib/calc";

export const metadata = { title: "Timeline" };
export default function Timeline() {
  const deals = loadDeals();
  const years = [...new Set(deals.map((d) => d.year))].sort((a, b) => (a === "Undated" ? 1 : b === "Undated" ? -1 : b.localeCompare(a)));
  return (
    <div>
      <PageHeader title="Timeline" kicker="The business, year by year" sub="Each deal sits at its payment date, or its posting or agreement date when no payment date is recorded. Deals with no dates at all are kept at the end." />
      {years.map((y) => {
        const ds = deals.filter((d) => d.year === y).sort((a, b) => (b.deal_date ?? "").localeCompare(a.deal_date ?? ""));
        const rec: Record<string, number> = {}; for (const d of ds) for (const [c, v] of Object.entries(d.fin.recognized)) addMoney(rec, c, v);
        return (
          <section key={y} className="mb-12 grid gap-x-10 md:grid-cols-[160px_1fr]">
            <div className="md:sticky md:top-8 md:self-start"><h2 className="serif text-[48px] leading-none">{y}</h2><div className="mt-2 text-[12.5px] text-mute">{ds.length} deals<br />{Object.keys(rec).length ? `${moneyMap(rec)} received` : "no received revenue recorded"}</div></div>
            <ol className="border-l border-line/15 pl-5">
              {ds.map((d) => (
                <li key={d.id} className="relative flex flex-wrap items-baseline justify-between gap-x-4 border-b border-line/[0.06] py-2.5 last:border-0">
                  <span className="absolute -left-[25px] top-[15px] h-[7px] w-[7px] rounded-full bg-ink/60" />
                  <span className="min-w-0"><Link href={`/deals/${d.id}`} className="font-medium hover:text-accent">{d.company_name ?? d.name}</Link><span className="ml-2 text-[12.5px] text-mute">{d.campaign_id ? d.name.replace(`${d.company_name} - `, "").replace(d.company_name ?? "", "") : ""}</span><span className="ml-2 text-[11.5px] text-faint">{d.deal_date ? dateLabel(d.deal_date) : ""}</span></span>
                  <span className="flex items-center gap-2 tabular-nums"><Badge tone={STAGE_TONE[d.stage]}>{d.stage}</Badge>{d.fin.gross === null ? <Unknown /> : money(d.fin.gross, d.currency)}</span>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
