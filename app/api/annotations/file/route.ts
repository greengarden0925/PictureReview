import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getDataDir } from "@/lib/paths";

export const dynamic = "force-dynamic";

/** GET /api/annotations/file?filename=xxx.png — 下載標記圖片 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const filename = url.searchParams.get("filename")?.trim() ?? "";

  // 防止 path traversal
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return NextResponse.json({ error: "invalid filename" }, { status: 400 });
  }
  if (!filename.endsWith(".png")) {
    return NextResponse.json({ error: "only png supported" }, { status: 400 });
  }

  const filePath = path.join(getDataDir(), "annotations", filename);

  try {
    const data = await fs.readFile(filePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
