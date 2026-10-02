import { NextRequest, NextResponse } from "next/server";
import { importRows, parseCSV, parseXLSX, restoreJSON } from "@/lib/exportimport";
import { revalidatePath } from "next/cache";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData();
    const kind = String(fd.get("kind") ?? ""); const file = fd.get("file") as File | null;
    if (!file || !kind) return NextResponse.json({ error: "Choose a file and a kind." }, { status: 400 });
    const name = file.name; const lower = name.toLowerCase();
    if (kind === "backup") {
      const data = JSON.parse(await file.text());
      const replace = String(fd.get("mode")) === "replace";
      if (replace && String(fd.get("confirm")) !== "REPLACE") return NextResponse.json({ error: "Type REPLACE to confirm replacing all current data." }, { status: 400 });
      const res = restoreJSON(data, replace);
      revalidatePath("/", "layout");
      return NextResponse.json({ ok: true, message: replace ? "Backup restored. Your previous data was saved first." : "Backup merged. Existing records were kept.", ...res });
    }
    let rows: Record<string, string>[];
    if (lower.endsWith(".xlsx")) rows = await parseXLSX(await file.arrayBuffer(), String(fd.get("sheet") || "") || undefined);
    else if (lower.endsWith(".json")) { const j = JSON.parse(await file.text()); rows = (Array.isArray(j) ? j : j.rows ?? []).map((r: any) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === null || v === undefined ? "" : String(v)]))); }
    else rows = parseCSV(await file.text());
    const res = importRows(kind, rows, name);
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, message: `${res.inserted} added, ${res.skipped} skipped.`, ...res });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Import failed" }, { status: 500 });
  }
}
