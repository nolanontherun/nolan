import Link from "next/link";
import { search } from "@/lib/search";
import { PageHeader, Empty } from "@/components/ui";

export const metadata = { title: "Search" };
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const r = search(q, 40);
  return (
    <div>
      <PageHeader title={q ? `“${q}”` : "Search"} kicker={q ? `${r.total} results` : "Everything in one place"} sub="Try plain questions: “Sony deals”, “deals over $10k”, “unpaid invoices”, “brands from 2025”, “all camera companies”, “contacts at agencies”, “deals with paid usage”.">
      </PageHeader>
      <form className="mb-6 flex max-w-2xl gap-2" action="/search"><input name="q" defaultValue={q} autoFocus className="input" placeholder="Search deals, people, invoices, notes…" /><button className="btn btn-primary">Search</button></form>
      {r.interpreted.length > 0 && <p className="mb-8 text-[12.5px] text-mute">Understood as: {r.interpreted.join(" · ")}</p>}
      {q && r.total === 0 && <Empty title="Nothing matched">Check the spelling, or try a company, a person or a year.</Empty>}
      {r.groups.map((g) => (
        <section key={g.kind} className="mb-9"><h2 className="caps mb-2">{g.kind} · {g.hits.length}</h2>
          <ul className="border-t border-line/10">{g.hits.map((h) => <li key={h.kind + h.id} className="border-b border-line/[0.07] py-2.5"><Link href={h.href} className="text-[13.5px] font-medium hover:text-accent">{h.title}</Link><div className="text-[12px] text-mute">{h.sub}</div></li>)}</ul></section>
      ))}
    </div>
  );
}
