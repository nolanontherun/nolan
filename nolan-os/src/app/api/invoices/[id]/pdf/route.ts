import { NextRequest, NextResponse } from "next/server";
import { invoicePdf, loadInvoice } from "@/lib/invoice";
export const dynamic = "force-dynamic";
export async function GET(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const f = loadInvoice(id);
  if (!f) return new NextResponse("Not found", { status: 404 });
  const buf = await invoicePdf(id);
  return new NextResponse(new Uint8Array(buf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${(f.inv.number ?? "invoice").replace(/[^A-Za-z0-9._-]/g, "_")}.pdf"` } });
}
