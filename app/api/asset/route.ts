import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { resolveSafeOutputRelative } from "@/lib/paths";

export const dynamic = "force-dynamic";

function contentTypeForExt(ext: string): string {
  const e = ext.toLowerCase();
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".txt": "text/plain; charset=utf-8",
    ".json": "application/json; charset=utf-8",
  };
  return map[e] ?? "application/octet-stream";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rel = url.searchParams.get("path");
  if (!rel) {
    return NextResponse.json({ error: "missing path" }, { status: 400 });
  }
  let abs: string;
  try {
    abs = resolveSafeOutputRelative(rel);
  } catch {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  try {
    const buf = await fs.readFile(abs);
    const ct = contentTypeForExt(path.extname(abs));
    return new NextResponse(buf, {
      headers: {
        "Content-Type": ct,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
