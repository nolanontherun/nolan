import Link from "next/link";
import { companyRows } from "@/lib/queries";
import { Empty, PageHeader, Unknown } from "@/components/ui";
import { dateLabel, moneyMap, money } from "@/lib/format";
import { createCompany } from "@/lib/actions";
import { ActionForm } from "@/components/Forms";
import { CATEGORIES } from "@/lib/constants";

export const metadata = { title: "Companies" };
type SP = { q?: string; f?: string; tag?: string; sort?: string };

export default async function Companies({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  let rows = companyRows();
  const q = sp.q?.toLowerCase().trim();
  if (q) rows = rows.filter((c) => [c.name, c.category, c.company_type, c.notes, c.tags.join(" ")].join(" ").toLowerCase().includes(q));
  if (sp.f === "repeat") rows = rows.filter((c) => c.dealCount > 1);
  if (sp.f === "owing") rows = rows.filter((c) => Object.keys(c.outstanding).length);
  if (sp.f === "active") rows = rows.filter((c) => c.active > 0);
  if (sp.tag) rows = rows.filter((c) => c.tags.includes(sp.tag!));
  const total = (c: (typeof rows)[number]) => Object.values(c.lifetime).reduce((s: number, v) => s + (v as number), 0);
  rows = [...rows].sort((a, b) => (sp.sort === "name" ? a.name.localeCompare(b.name) : sp.sort === "deals" ? b.dealCount - a.dealCount : sp.sort === "recent" ? (b.last ?? "").localeCompare(a.last ?? "") : total(b) - total(a)));
  const chip = (on: boolean) => `chip ${on ? "chip-on" : ""}`;
  const tags = [...new Set(companyRows().flatMap((c) => c.tags))].sort();
  return (
    <div>
      <PageHeader title="Companies" kicker={`${companyRows().length} on record`} sub="Brands, artists, labels and platforms you have worked with. Revenue is the money received, per currency, never converted.">
        <a href="/api/export/companies" className="btn btn-sm">Export CSV</a>
      </PageHeader>
      <form className="mb-4 flex gap-2" action="/companies"><input name="q" defaultValue={sp.q} placeholder="Search companies, categories, tags…" className="input max-w-md" /><button className="btn">Search</button></form>
      <div className="mb-6 flex flex-wrap gap-1.5">
        <Link href="/companies" className={chip(!sp.f && !sp.tag)}>All</Link>
        <Link href="/companies?f=repeat" className={chip(sp.f === "repeat")}>Worked with more than once</Link>
        <Link href="/companies?f=active" className={chip(sp.f === "active")}>Open deals</Link>
        <Link href="/companies?f=owing" className={chip(sp.f === "owing")}>Owes money</Link>
        {tags.map((t) => <Link key={t} href={`/companies?tag=${encodeURIComponent(t)}`} className={chip(sp.tag === t)}>{t}</Link>)}
      </div>
      {rows.length ? (
        <>
          <table className="tbl hidden md:table"><thead><tr><th>Company</th><th>Category</th><th className="text-right">Deals</th><th className="text-right">Received</th><th className="text-right">Owed</th><th>Last activity</th></tr></thead><tbody>
            {rows.map((c) => <tr key={c.id}><td><Link href={`/companies/${c.id}`} className="font-medium hover:text-accent">{c.name}</Link>{c.company_type && <div className="text-[12px] text-mute">{c.company_type}</div>}</td><td className="text-mute">{c.category ?? "—"}</td><td className="num">{c.dealCount}</td><td className="num">{Object.keys(c.lifetime).length ? moneyMap(c.lifetime) : <Unknown text="—" />}</td><td className="num">{Object.keys(c.outstanding).length ? <span className="text-bad">{moneyMap(c.outstanding)}</span> : "—"}</td><td className="text-mute">{c.last ? dateLabel(c.last, { year: true }) : "—"}</td></tr>)}
          </tbody></table>
          <ul className="md:hidden">{rows.map((c) => <li key={c.id} className="border-b border-line/[0.08] py-3"><Link href={`/companies/${c.id}`} className="flex justify-between gap-3"><span><span className="block font-medium">{c.name}</span><span className="text-[12px] text-mute">{c.dealCount} deal{c.dealCount === 1 ? "" : "s"} · {c.category ?? "no category"}</span></span><span className="text-right text-[13px] tabular-nums">{Object.keys(c.lifetime).length ? moneyMap(c.lifetime) : "—"}</span></Link></li>)}</ul>
        </>
      ) : <Empty title="No companies match">Adjust the search or filters.</Empty>}
      <details className="mt-10 no-print"><summary className="btn btn-sm cursor-pointer list-none">New company</summary>
        <ActionForm action={createCompany} submit="Create" className="mt-3 max-w-2xl"><div className="grid gap-3 sm:grid-cols-2"><label><span className="label">Name</span><input name="name" required className="input" /></label><label><span className="label">Category</span><select name="category" className="input"><option value="">Not set</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label><label><span className="label">Website</span><input name="website" className="input" /></label><label><span className="label">Country</span><input name="country" className="input" /></label></div></ActionForm></details>
    </div>
  );
}
