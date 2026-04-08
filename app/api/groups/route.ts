import { NextResponse } from "next/server";
import { scanOutputGroups } from "@/lib/groupOutputFiles";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const groups = await scanOutputGroups();
    return NextResponse.json({ groups });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "scan failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
