"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { NAV } from "./nav";
import { QuickAdd } from "./QuickAdd";

type Hit = { kind: string; id: string; title: string; sub: string; href: string };
type Res = { interpreted: string[]; groups: { kind: string; hits: Hit[] }[] };

export function Shell({ children, attention, urgent, deals }: { children: React.ReactNode; attention: number; urgent: number; deals: { id: string; name: string }[] }) {
  const path = usePathname();
  const router = useRouter();
  const [palette, setPalette] = useState(false);
  const [quick, setQuick] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [help, setHelp] = useState(false);
  const [theme, setTheme] = useState<string>("system");
  const gRef = useRef<number>(0);

  useEffect(() => { try { setTheme(localStorage.getItem("nos-theme") ?? "system"); } catch {} }, []);
  useEffect(() => { if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("/sw.js").catch(() => {}); }, []);
  useEffect(() => { setMore(false); }, [path]);

  const toggleTheme = () => {
    const dark = document.documentElement.getAttribute("data-theme") === "dark" || (!document.documentElement.getAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
    const next = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("nos-theme", next); } catch {}
    setTheme(next);
  };

  const onKey = useCallback((e: KeyboardEvent) => {
    const el = e.target as HTMLElement;
    const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); return; }
    if (typing) return;
    if (e.key === "/") { e.preventDefault(); setPalette(true); return; }
    if (e.key === "n" && !e.metaKey && !e.ctrlKey) { e.preventDefault(); setQuick("deal"); return; }
    if (e.key === "?") { setHelp((h) => !h); return; }
    if (e.key === "g") { gRef.current = Date.now(); return; }
    if (Date.now() - gRef.current < 900) {
      const map: Record<string, string> = { t: "/", a: "/attention", d: "/deals", c: "/companies", p: "/contacts", i: "/invoices", m: "/revenue", n: "/analytics", e: "/inbox", s: "/settings" };
      if (map[e.key]) { gRef.current = 0; router.push(map[e.key]); }
    }
  }, [router]);
  useEffect(() => { window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onKey]);

  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const NavLink = ({ n }: { n: (typeof NAV)[number] }) => (
    <Link href={n.href} className={`group flex items-center gap-2.5 rounded-[5px] px-2 py-[5px] text-[13px] transition ${active(n.href) ? "bg-line/[0.07] text-ink" : "text-mute hover:bg-line/[0.04] hover:text-ink"}`}>
      <Icon name={n.icon} size={15} className={active(n.href) ? "text-accent" : ""} />
      <span className="flex-1 truncate">{n.label}</span>
      {n.href === "/attention" && attention > 0 && <span className={`rounded-full px-1.5 text-[10.5px] font-medium ${urgent ? "bg-bad/15 text-bad" : "bg-line/10 text-mute"}`}>{attention}</span>}
    </Link>
  );
  const groups = [...new Set(NAV.map((n) => n.group))];
  const title = NAV.find((n) => active(n.href))?.label ?? "Nolan OS";

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[232px_1fr]">
      {/* desktop rail */}
      <aside className="no-print sticky top-0 hidden h-screen flex-col border-r border-line/10 bg-surface px-3 py-5 lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-2.5 px-2">
          <span className="grid h-7 w-7 place-items-center rounded-[5px] bg-ink text-bg"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 20V5l14 15V5" /></svg></span>
          <span><span className="serif block text-[19px] leading-none">Nolan OS</span><span className="caps text-[9px]">On The Run</span></span>
        </Link>
        <button onClick={() => setQuick("deal")} className="btn btn-primary mb-3 w-full justify-between"><span className="inline-flex items-center gap-1.5"><Icon name="plus" size={14} />Quick add</span><span className="kbd !border-bg/30 !bg-transparent !text-bg/70">N</span></button>
        <button onClick={() => setPalette(true)} className="btn mb-4 w-full justify-between text-mute"><span className="inline-flex items-center gap-1.5"><Icon name="search" size={14} />Search</span><span className="kbd">⌘K</span></button>
        <nav className="-mx-1 flex-1 space-y-4 overflow-y-auto px-1 pb-4">
          <div>{NAV.filter((n) => n.core).map((n) => <NavLink key={n.href} n={n} />)}</div>
          <details className="group/more" open={NAV.some((n) => !n.core && active(n.href))}>
            <summary className="caps mb-1 cursor-pointer px-2 text-[9.5px] text-faint">More</summary>
            {groups.map((g) => <div key={g} className="mb-3">{NAV.filter((n) => !n.core && n.group === g).map((n) => <NavLink key={n.href} n={n} />)}</div>)}
          </details>
        </nav>
        <div className="flex items-center justify-between border-t border-line/10 px-2 pt-3 text-mute">
          <button onClick={toggleTheme} className="btn btn-ghost btn-sm" aria-label="Toggle theme"><Icon name={theme === "dark" ? "sun" : "moon"} size={14} />{theme === "dark" ? "Light" : "Dark"}</button>
          <button onClick={() => setHelp(true)} className="btn btn-ghost btn-sm" aria-label="Keyboard shortcuts"><span className="kbd">?</span></button>
        </div>
      </aside>

      {/* mobile top bar */}
      <div className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-line/10 bg-bg/90 px-4 py-2.5 backdrop-blur lg:hidden" style={{ paddingTop: "max(env(safe-area-inset-top), 10px)" }}>
        <span className="serif text-[21px]">{title}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setPalette(true)} className="btn btn-ghost !px-2" aria-label="Search"><Icon name="search" size={18} /></button>
          <button onClick={toggleTheme} className="btn btn-ghost !px-2" aria-label="Toggle theme"><Icon name={theme === "dark" ? "sun" : "moon"} size={18} /></button>
        </div>
      </div>

      <main className="min-w-0 px-4 pb-28 pt-6 sm:px-8 lg:px-12 lg:pb-16 lg:pt-10">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>

      {/* mobile bottom nav */}
      <nav className="no-print safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line/10 bg-surface/95 backdrop-blur lg:hidden" aria-label="Primary">
        {[{ href: "/", l: "Today", i: "today" }, { href: "/attention", l: "Attention", i: "attention" }].map((n) => (
          <Link key={n.href} href={n.href} className={`relative flex flex-col items-center gap-0.5 py-2 text-[10.5px] ${active(n.href) ? "text-ink" : "text-mute"}`}><Icon name={n.i} size={20} />{n.l}{n.href === "/attention" && attention > 0 && <span className={`absolute right-[26%] top-1.5 h-2 w-2 rounded-full ${urgent ? "bg-bad" : "bg-faint"}`} />}</Link>
        ))}
        <button onClick={() => setQuick("deal")} className="flex items-center justify-center" aria-label="Quick add"><span className="grid h-11 w-11 -translate-y-2 place-items-center rounded-full bg-ink text-bg shadow-lg"><Icon name="plus" size={20} /></span></button>
        <Link href="/deals" className={`flex flex-col items-center gap-0.5 py-2 text-[10.5px] ${active("/deals") ? "text-ink" : "text-mute"}`}><Icon name="deals" size={20} />Deals</Link>
        <button onClick={() => setMore(true)} className="flex flex-col items-center gap-0.5 py-2 text-[10.5px] text-mute"><Icon name="menu" size={20} />More</button>
      </nav>

      {more && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMore(false)}>
          <div className="absolute inset-0 bg-black/40 fade-in" />
          <div className="rise safe-bottom absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-[14px] bg-surface p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line/20" />
            {groups.map((g) => (
              <div key={g} className="mb-4"><div className="caps mb-1.5">{g}</div>
                <div className="grid grid-cols-2 gap-1.5">{NAV.filter((n) => n.group === g).map((n) => <Link key={n.href} href={n.href} className="flex items-center gap-2 rounded-[6px] border border-line/10 px-3 py-2.5 text-[13px]"><Icon name={n.icon} size={16} className="text-mute" />{n.label}</Link>)}</div></div>
            ))}
          </div>
        </div>
      )}

      {palette && <Palette onClose={() => setPalette(false)} onQuick={(k) => { setPalette(false); setQuick(k); }} />}
      {quick && <QuickAdd start={quick} deals={deals} onClose={() => setQuick(null)} />}
      {help && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" onClick={() => setHelp(false)}>
          <div className="rise w-full max-w-md rounded-[8px] border border-line/15 bg-raised p-5" onClick={(e) => e.stopPropagation()}>
            <div className="serif mb-3 text-[24px]">Keyboard shortcuts</div>
            <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-[13px]">
              {[["Search everything", "⌘K or /"], ["Quick add", "N"], ["Today", "G then T"], ["Attention", "G then A"], ["Deals", "G then D"], ["Companies", "G then C"], ["Contacts", "G then P"], ["Invoices", "G then I"], ["Revenue", "G then M"], ["Analytics", "G then N"], ["Inbox", "G then E"], ["Settings", "G then S"], ["This help", "?"]].map(([a, b]) => <><dt key={a} className="text-mute">{a}</dt><dd key={b} className="text-right"><span className="kbd">{b}</span></dd></>)}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

function Palette({ onClose, onQuick }: { onClose: () => void; onQuick: (k: string) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Res | null>(null);
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    if (!q.trim()) { setRes(null); return; }
    const t = setTimeout(() => fetch(`/api/search?q=${encodeURIComponent(q)}`).then((r) => r.json()).then((r) => { setRes(r); setIdx(0); }).catch(() => {}), 120);
    return () => clearTimeout(t);
  }, [q]);
  const cmds = [
    { title: "New deal", sub: "Quick add", run: () => onQuick("deal") }, { title: "New contact", sub: "Quick add", run: () => onQuick("contact") }, { title: "New invoice", sub: "Quick add", run: () => { router.push("/invoices/new"); onClose(); } },
    { title: "Log payment", sub: "Quick add", run: () => onQuick("payment") }, { title: "Add follow-up", sub: "Quick add", run: () => onQuick("followup") },
    ...NAV.map((n) => ({ title: `Go to ${n.label}`, sub: "Navigate", run: () => { router.push(n.href); onClose(); } })),
  ];
  const flat: { title: string; sub: string; run: () => void }[] = q.trim()
    ? [...(res?.groups ?? []).flatMap((g) => g.hits.slice(0, 6).map((h) => ({ title: h.title, sub: `${h.kind} · ${h.sub}`, run: () => { router.push(h.href); onClose(); } }))), { title: `See all results for “${q}”`, sub: "Search", run: () => { router.push(`/search?q=${encodeURIComponent(q)}`); onClose(); } }]
    : cmds.slice(0, 12);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 p-3 pt-[9vh] fade-in" onClick={onClose}>
      <div className="rise w-full max-w-xl overflow-hidden rounded-[10px] border border-line/15 bg-raised shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line/10 px-3.5">
          <Icon name="search" size={16} className="text-mute" />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search deals, people, invoices… or ask “unpaid invoices”" className="w-full bg-transparent py-3.5 text-[14.5px] outline-none placeholder:text-faint"
            onKeyDown={(e) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(flat.length - 1, i + 1)); } if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); } if (e.key === "Enter") flat[idx]?.run(); }} />
          <span className="kbd">esc</span>
        </div>
        {res && res.interpreted.length > 0 && <div className="border-b border-line/10 px-3.5 py-2 text-[11.5px] text-mute">Understood as: {res.interpreted.join(" · ")}</div>}
        <ul className="max-h-[56vh] overflow-y-auto p-1.5">
          {flat.map((r, i) => (
            <li key={i}><button onMouseEnter={() => setIdx(i)} onClick={r.run} className={`flex w-full items-baseline justify-between gap-3 rounded-[6px] px-2.5 py-2 text-left text-[13px] ${i === idx ? "bg-line/[0.07]" : ""}`}><span className="truncate">{r.title}</span><span className="shrink-0 truncate text-[11.5px] text-mute">{r.sub}</span></button></li>
          ))}
          {q.trim() && res && res.groups.length === 0 && <li className="px-3 py-4 text-[13px] text-mute">Nothing matched. Try a company name, a person, or “deals over $5k”.</li>}
        </ul>
      </div>
    </div>
  );
}
