import { NextRequest, NextResponse } from "next/server";
import { search } from "@/lib/search";
export const dynamic = "force-dynamic";
export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json(search(q, 6));
}
