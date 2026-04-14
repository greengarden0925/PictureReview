import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { annotationBasename, annotationsDir } from "@/lib/annotationUtils";

export const dynamic = "force-dynamic";

/** GET /api/annotations — 列出所有已上傳的標記圖 */
export async function GET() {
  const dir = annotationsDir();
  await fs.mkdir(dir, { recursive: true });

  const files = await fs.readdir(dir);
  const metaFiles = files.filter((f) => f.endsWith(".meta.json"));

  const annotations = await Promise.all(
    metaFiles.map(async (f) => {
      const raw = await fs.readFile(path.join(dir, f), "utf-8");
      return JSON.parse(raw) as {
        reviewerName: string;
        groupKey: string;
        imageKey: string;
        uploadedAt: string;
        filename: string;
      };
    })
  );

  annotations.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  return NextResponse.json({ annotations });
}

/** POST /api/annotations — 儲存標記圖（base64 PNG） */
export async function POST(request: Request) {
  let body: {
    reviewerName?: string;
    groupKey?: string;
    imageKey?: string;
    imageData?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { reviewerName, groupKey, imageKey, imageData } = body;
  if (!reviewerName || !groupKey || !imageKey || !imageData) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  if (!["A", "B"].includes(imageKey)) {
    return NextResponse.json({ error: "invalid imageKey" }, { status: 400 });
  }

  const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");

  const dir = annotationsDir();
  await fs.mkdir(dir, { recursive: true });

  const base = annotationBasename(reviewerName, groupKey, imageKey);
  const uploadedAt = new Date().toISOString();
  const filename = `${base}.png`;

  await fs.writeFile(path.join(dir, filename), buffer);
  await fs.writeFile(
    path.join(dir, `${base}.meta.json`),
    JSON.stringify(
      { reviewerName, groupKey, imageKey, uploadedAt, filename },
      null,
      2
    ),
    "utf-8"
  );

  return NextResponse.json({ ok: true, uploadedAt });
}
