import { money } from "@/lib/format";

/** Horizontal bars. Values share one scale starting at zero. */
export function BarList({ rows, currency = "USD", max, fmt, href }: { rows: { key: string; value: number; sub?: string; href?: string }[]; currency?: string; max?: number; fmt?: (v: number) => string; href?: (k: string) => string | undefined }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(90px,36%)_1fr_auto] items-center gap-3 text-[13px]">
          <span className="truncate" title={r.key}>{r.key}</span>
          <span className="relative h-[7px] rounded-[2px] bg-line/[0.06]"><span className="absolute inset-y-0 left-0 rounded-[2px] bg-ink/80" style={{ width: `${Math.max(1.5, (r.value / m) * 100)}%` }} /></span>
          <span className="tabular-nums text-mute">{fmt ? fmt(r.value) : money(r.value, currency, { compact: true })}</span>
        </li>
      ))}
    </ul>
  );
}

/** Column chart with a zero baseline and labelled ends; no decoration. */
export function Columns({ data, currency = "USD", height = 140, highlight, label = (k: string) => k }: { data: { key: string; value: number }[]; currency?: string; height?: number; highlight?: string; label?: (k: string) => string }) {
  if (!data.length) return null;
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / data.length;
  const step = Math.ceil(data.length / 8);
  return (
    <div>
      <svg viewBox={`0 0 100 ${height / 4}`} preserveAspectRatio="none" className="h-[var(--h)] w-full overflow-visible" style={{ ["--h" as any]: `${height}px` }} role="img" aria-label="Bar chart">
        <line x1="0" x2="100" y1={height / 4} y2={height / 4} stroke="currentColor" strokeOpacity="0.25" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
        {data.map((d, i) => {
          const h = (d.value / max) * (height / 4 - 2);
          return <rect key={d.key} x={i * w + w * 0.16} y={height / 4 - h} width={w * 0.68} height={Math.max(h, d.value ? 0.4 : 0)} fill={d.key === highlight ? "rgb(var(--accent))" : "currentColor"} fillOpacity={d.key === highlight ? 1 : 0.78}><title>{`${label(d.key)}: ${money(d.value, currency)}`}</title></rect>;
        })}
      </svg>
      <div className="mt-1.5 flex justify-between text-[10.5px] text-faint">
        {data.map((d, i) => <span key={d.key} style={{ width: `${w}%` }} className="truncate text-center">{i % step === 0 ? label(d.key) : ""}</span>)}
      </div>
    </div>
  );
}

export function Spark({ values, height = 36, width = 120 }: { values: number[]; height?: number; width?: number }) {
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * width},${height - 2 - (v / max) * (height - 4)}`).join(" ");
  return <svg width={width} height={height} className="text-ink/70" aria-hidden><polyline fill="none" stroke="currentColor" strokeWidth="1.4" points={pts} /></svg>;
}

/** A proportional strip for the pipeline. */
export function Strip({ parts }: { parts: { key: string; value: number; tone?: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-[2px] bg-line/[0.06]">
      {parts.map((p) => <span key={p.key} title={`${p.key}: ${p.value}`} style={{ width: `${(p.value / total) * 100}%` }} className={p.tone ?? "bg-ink/70"} />)}
    </div>
  );
}

/** Cumulative line with a zero baseline; shows start and end values. */
export function Line({ data, currency = "USD", height = 150 }: { data: { key: string; value: number }[]; currency?: string; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(1, ...data.map((d) => d.value));
  const H = height / 4, pts = data.map((d, i) => [(i / (data.length - 1)) * 100, H - 2 - (d.value / max) * (H - 4)]);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="w-full overflow-visible" style={{ height }} role="img" aria-label="Cumulative income line">
        <line x1="0" x2="100" y1={H} y2={H} stroke="currentColor" strokeOpacity="0.25" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
        <path d={`${path} L100 ${H} L0 ${H} Z`} fill="currentColor" fillOpacity="0.06" />
        <path d={path} fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[11.5px] text-mute"><span>{data[0].key}</span><span className="tabular-nums">{money(data[data.length - 1].value, currency, { compact: true })} total</span></div>
    </div>
  );
}
