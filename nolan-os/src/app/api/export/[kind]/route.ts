import { NextRequest, NextResponse } from "next/server";
import { buildWorkbook, EXPORT_KINDS, exportRows, ExportKind, toCSV } from "@/lib/exportimport";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  const format = req.nextUrl.searchParams.get("format") ?? "csv";
  const stamp = new Date().toISOString().slice(0, 10);
  if (kind === "all" && format === "xlsx") {
    const buf = await buildWorkbook(EXPORT_KINDS);
    return new NextResponse(new Uint8Array(buf), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="nolan-os-all-${stamp}.xlsx"` } });
  }
  if (!EXPORT_KINDS.includes(kind as ExportKind)) return new NextResponse("Unknown export", { status: 404 });
  const k = kind as ExportKind;
  let filter: ((d: any) => boolean) | undefined;
  if (k === "deals") {
    const sp = req.nextUrl.searchParams; const q = sp.get("q")?.toLowerCase();
    filter = (d) => (!q || [d.name, d.company_name, d.agency_name, d.category].join(" ").toLowerCase().includes(q)) && (!sp.get("year") || d.year === sp.get("year")) && (!sp.get("category") || d.category === sp.get("category")) && (!sp.get("stage") || sp.get("stage") === "open" || d.stage === sp.get("stage")) && (sp.get("pay") !== "unpaid" || !!d.fin.outstanding);
  }
  if (format === "xlsx") {
    const buf = await buildWorkbook([k]);
    return new NextResponse(new Uint8Array(buf), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="nolan-os-${k}-${stamp}.xlsx"` } });
  }
  const rows = exportRows(k, filter);
  if (format === "json") return new NextResponse(JSON.stringify(rows, null, 2), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="nolan-os-${k}-${stamp}.json"` } });
  return new NextResponse("﻿" + toCSV(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="nolan-os-${k}-${stamp}.csv"` } });
}
