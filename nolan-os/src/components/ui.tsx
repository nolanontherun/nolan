import Link from "next/link";
import { ReactNode } from "react";
import { NR } from "@/lib/format";

export function PageHeader({ title, kicker, children, sub }: { title: string; kicker?: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-line/10 pb-5 rise">
      <div className="min-w-0">
        {kicker && <div className="caps mb-1.5">{kicker}</div>}
        <h1 className="serif text-[34px] leading-[1.05] sm:text-[42px]">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-[13.5px] text-mute">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function Section({ title, aside, children, className = "", id }: { title?: string; aside?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`mb-10 ${className}`}>
      {(title || aside) && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          {title && <h2 className="caps">{title}</h2>}
          {aside && <div className="text-[12px] text-mute">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone, big }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "bad" | "good" | "warn"; big?: boolean }) {
  const c = tone === "bad" ? "text-bad" : tone === "good" ? "text-good" : tone === "warn" ? "text-warn" : "text-ink";
  return (
    <div className="min-w-0">
      <div className="caps">{label}</div>
      <div className={`${big ? "serif text-[40px] leading-none" : "text-[22px] font-medium leading-tight"} mt-1 tabular-nums ${c}`}>{value}</div>
      {sub && <div className="mt-1 text-[12px] text-mute">{sub}</div>}
    </div>
  );
}

export function Badge({ children, tone = "mute" }: { children: ReactNode; tone?: "good" | "warn" | "bad" | "mute" | "accent" }) {
  const t = { good: "text-good border-good/30 bg-good/[0.07]", warn: "text-warn border-warn/30 bg-warn/[0.07]", bad: "text-bad border-bad/30 bg-bad/[0.07]", mute: "text-mute border-line/15", accent: "text-accent border-accent/30 bg-accent/[0.07]" }[tone];
  return <span className={`inline-flex items-center whitespace-nowrap rounded-[4px] border px-1.5 py-[1px] text-[11px] font-medium ${t}`}>{children}</span>;
}

export function Unknown({ text = NR }: { text?: string }) {
  return <span className="italic text-faint">{text}</span>;
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[6px] border border-dashed border-line/20 px-6 py-10 text-center">
      <div className="serif text-[22px]">{title}</div>
      {children && <p className="mx-auto mt-1.5 max-w-md text-[13px] text-mute">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Field({ label, children, hint, className = "" }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-faint">{hint}</span>}
    </label>
  );
}

export function KV({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/[0.07] py-2 text-[13px]">
      <dt className="text-mute">{k}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

export function Tabs({ tabs, active, base }: { tabs: { id: string; label: string; count?: number }[]; active: string; base: string }) {
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-line/10 no-print">
      {tabs.map((t) => (
        <Link key={t.id} href={`${base}${base.includes("?") ? "&" : "?"}tab=${t.id}`} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[13px] transition ${active === t.id ? "border-ink text-ink" : "border-transparent text-mute hover:text-ink"}`}>
          {t.label}{t.count !== undefined && <span className="ml-1.5 text-faint">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function Source({ s }: { s: string | null | undefined }) {
  if (!s) return null;
  const label = s.split("+").map((x) => ({ spreadsheet: "Spreadsheet", figma: "Figma", gmail: "Gmail", manual: "Manual", email: "Email", pasted: "Pasted email" }[x] ?? x)).join(" + ");
  return <span className="text-[11px] text-faint">{label}</span>;
}
