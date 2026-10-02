"use client";
import { useState } from "react";

export function ImportForm({ kinds }: { kinds: { id: string; label: string }[] }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string; extra?: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState(kinds[0].id);
  const [mode, setMode] = useState("merge");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (kind === "backup" && mode === "replace" && !confirm("Replace ALL current data with this backup? A copy of your current data is saved first.")) return;
    setBusy(true); setMsg(null);
    const r = await fetch("/api/import", { method: "POST", body: fd });
    const j = await r.json();
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: j.message, extra: j.errors } : { ok: false, text: j.error });
  }
  return (
    <form onSubmit={submit} className="grid max-w-2xl gap-3 sm:grid-cols-2">
      <label><span className="label">What are you importing</span><select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="input">{kinds.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></label>
      <label><span className="label">File (.csv, .xlsx, .json)</span><input type="file" name="file" required accept=".csv,.xlsx,.json" className="input" /></label>
      {kind === "backup" && <>
        <label><span className="label">Mode</span><select name="mode" value={mode} onChange={(e) => setMode(e.target.value)} className="input"><option value="merge">Merge: keep existing records, add missing ones</option><option value="replace">Replace everything</option></select></label>
        {mode === "replace" && <label><span className="label">Type REPLACE to confirm</span><input name="confirm" className="input" autoComplete="off" /></label>}
      </>}
      <div className="sm:col-span-2"><button disabled={busy} className="btn btn-primary">{busy ? "Importing…" : "Import"}</button></div>
      {msg && <p className={`sm:col-span-2 rounded-[5px] border px-3 py-2 text-[12.5px] ${msg.ok ? "border-good/40 bg-good/10 text-good" : "border-bad/40 bg-bad/10 text-bad"}`}>{msg.text}{msg.extra?.length ? <span className="mt-1 block text-mute">{msg.extra.join(" · ")}</span> : null}</p>}
    </form>
  );
}
