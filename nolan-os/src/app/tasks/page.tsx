import Link from "next/link";
import { all } from "@/lib/db";
import { PageHeader, Section, Empty, Badge } from "@/components/ui";
import { completeTask, createTask, reopenTask, setTaskDate, snoozeTask } from "@/lib/actions";
import { ActionForm } from "@/components/Forms";
import { dateLabel, daysFromToday, relDays, today } from "@/lib/format";

export const metadata = { title: "Tasks" };
export default async function Tasks({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const t = today();
  const tasks = all<any>("SELECT t.*, d.name dname FROM tasks t LEFT JOIN deals d ON d.id=t.deal_id ORDER BY t.status DESC, COALESCE(t.due_date,'9999'), t.created_at");
  const deals = all<any>("SELECT id, name FROM deals WHERE archived = 0 ORDER BY name");
  const open = tasks.filter((x) => x.status === "open");
  const overdue = open.filter((x) => x.due_date && x.due_date < t);
  const dated = open.filter((x) => x.due_date && x.due_date >= t);
  const undated = open.filter((x) => !x.due_date);
  const done = tasks.filter((x) => x.status === "done").slice(0, 15);
  const Row = ({ k }: { k: any }) => (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line/[0.07] py-2.5">
      <form action={completeTask}><input type="hidden" name="id" value={k.id} /><button className="grid h-[18px] w-[18px] place-items-center rounded-full border border-line/35 hover:border-good" aria-label="Mark done" /></form>
      <div className="min-w-0 flex-1"><div className="text-[13.5px]">{k.title}</div><div className="text-[12px] text-mute">{k.dname ? <Link href={`/deals/${k.deal_id}`} className="hover:text-accent">{k.dname}</Link> : "General"}{k.source !== "manual" ? ` · from ${k.source}` : ""}</div></div>
      <form action={setTaskDate} className="flex items-center gap-1"><input type="hidden" name="id" value={k.id} /><input type="date" name="due_date" defaultValue={k.due_date ?? ""} className="input !w-[132px] !py-1" /><button className="btn btn-ghost btn-sm">Set</button></form>
      {k.due_date && <span className={`text-[12px] ${k.due_date < t ? "text-bad" : "text-mute"}`}>{relDays(daysFromToday(k.due_date))}</span>}
      <form action={snoozeTask}><input type="hidden" name="id" value={k.id} /><input type="hidden" name="days" value="3" /><button className="btn btn-ghost btn-sm text-mute">Snooze 3d</button></form>
    </li>
  );
  return (
    <div>
      <PageHeader title="Tasks and follow-ups" kicker={`${open.length} open`} sub="Imported next actions have no due date, so they sit under 'No date'. Give them one and they start to appear on Today." />
      <details className="mb-8 no-print" open><summary className="btn btn-sm cursor-pointer list-none">Add task</summary>
        <ActionForm action={createTask} submit="Add" resetOnOk className="mt-3 max-w-3xl"><div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]"><label><span className="label">Task</span><input name="title" required className="input" placeholder="Follow up with Sarah on Friday" /></label><label><span className="label">Due</span><input type="date" name="due_date" className="input" /></label><label><span className="label">Deal</span><select name="deal_id" className="input"><option value="">None</option>{deals.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label></div></ActionForm></details>
      {overdue.length > 0 && <Section title={`Overdue · ${overdue.length}`}><ul className="border-t border-line/10">{overdue.map((k) => <Row key={k.id} k={k} />)}</ul></Section>}
      {dated.length > 0 && <Section title={`Upcoming · ${dated.length}`}><ul className="border-t border-line/10">{dated.map((k) => <Row key={k.id} k={k} />)}</ul></Section>}
      {undated.length > 0 && <Section title={`No date · ${undated.length}`}><ul className="border-t border-line/10">{undated.map((k) => <Row key={k.id} k={k} />)}</ul></Section>}
      {!open.length && <Empty title="Nothing open">Add a task above or set a follow-up date on a deal.</Empty>}
      {done.length > 0 && <Section title="Recently done"><ul className="border-t border-line/10">{done.map((k) => <li key={k.id} className="flex items-center justify-between border-b border-line/[0.07] py-2 text-[13px] text-mute"><span className="line-through">{k.title}</span><form action={reopenTask}><input type="hidden" name="id" value={k.id} /><button className="btn btn-ghost btn-sm">Reopen</button></form></li>)}</ul></Section>}
    </div>
  );
}
