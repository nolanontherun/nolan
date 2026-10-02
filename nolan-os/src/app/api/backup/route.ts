import { NextRequest, NextResponse } from "next/server";
import { backupJSON } from "@/lib/exportimport";
import { getDb } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const stamp = new Date().toISOString().slice(0, 10);
  if (req.nextUrl.searchParams.get("format") === "db") {
    const buf = getDb().serialize();
    return new NextResponse(new Uint8Array(buf), { headers: { "content-type": "application/octet-stream", "content-disposition": `attachment; filename="nolan-os-${stamp}.db"` } });
  }
  return new NextResponse(JSON.stringify(backupJSON(), null, 1), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="nolan-os-backup-${stamp}.json"` } });
}
