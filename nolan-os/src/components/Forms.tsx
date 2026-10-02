"use client";
import { useRef } from "react";

/** Wraps a destructive server action in a native confirmation. The server also requires confirm=yes. */
export function ConfirmForm({ action, message, children, className = "" }: { action: (fd: FormData) => void | Promise<void>; message: string; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={action} className={className} onSubmit={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      <input type="hidden" name="confirm" value="yes" />
      {children}
    </form>
  );
}

export function PrintButton({ label = "Print" }: { label?: string }) {
  return <button type="button" onClick={() => window.print()} className="btn no-print">{label}</button>;
}

/** Textarea + submit that clears after saving. */
export function AutoSubmitSelect({ action, name, value, options, hidden = {}, className = "" }: { action: (fd: FormData) => void | Promise<void>; name: string; value: string; options: string[]; hidden?: Record<string, string>; className?: string }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={action} className={className}>
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <select name={name} defaultValue={value} className="input !w-auto !py-1" onChange={() => ref.current?.requestSubmit()}>{options.map((o) => <option key={o}>{o}</option>)}</select>
    </form>
  );
}

/** Generic form for server actions that return {ok, error, warnings}. */
import { useActionState } from "react";
export function ActionForm({ action, children, submit = "Save", className = "", resetOnOk = false }: { action: (s: any, fd: FormData) => Promise<any>; children: React.ReactNode; submit?: string; className?: string; resetOnOk?: boolean }) {
  const [state, act, pending] = useActionState(action, null);
  return (
    <form action={act} className={className} key={resetOnOk && state?.ok ? String(Date.now()) : undefined}>
      {state?.warnings?.map((w: string) => <p key={w} className="mb-2 rounded-[5px] border border-warn/40 bg-warn/10 px-3 py-2 text-[12.5px] text-warn">⚠ {w}</p>)}
      {state?.error && <p className="mb-2 rounded-[5px] border border-bad/40 bg-bad/10 px-3 py-2 text-[12.5px] text-bad">{state.error}</p>}
      {state?.ok && <p className="mb-2 text-[12.5px] text-good">Saved.</p>}
      {children}
      <button disabled={pending} className="btn btn-primary mt-3">{pending ? "Working…" : submit}</button>
    </form>
  );
}
