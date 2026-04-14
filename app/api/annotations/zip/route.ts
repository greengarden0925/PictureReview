import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { getDataDir } from "@/lib/paths";

export const dynamic = "force-dynamic";

/** GET /api/annotations/zip?reviewer=xxx — 批次下載標記圖片（ZIP）
 *  reviewer 參數省略時下載全部
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const reviewerFilter = url.searchParams.get("reviewer")?.trim() ?? null;

  const dir = path.join(getDataDir(), "annotations");

  // 讀取 meta 檔取得清單
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return NextResponse.json({ error: "no annotations" }, { status: 404 });
  }

  const metaFiles = files.filter((f) => f.endsWith(".meta.json"));
  if (metaFiles.length === 0) {
    return NextResponse.json({ error: "no annotations" }, { status: 404 });
  }

  const metas = await Promise.all(
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

  const filtered = reviewerFilter
    ? metas.filter((m) => m.reviewerName === reviewerFilter)
    : metas;

  if (filtered.length === 0) {
    return NextResponse.json({ error: "no annotations found" }, { status: 404 });
  }

  // 建立 ZIP
  const zip = new JSZip();

  await Promise.all(
    filtered.map(async (m) => {
      const filePath = path.join(dir, m.filename);
      try {
        const data = await fs.readFile(filePath);
        // 資料夾結構：{reviewerName}/{groupKey}_{imageKey}.png
        const folder = m.reviewerName;
        const name = `${m.groupKey}_${m.imageKey}圖_標記.png`;
        zip.folder(folder)!.file(name, data);
      } catch {
        // 跳過找不到的檔案
      }
    })
  );

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  const safeReviewer = reviewerFilter
    ? reviewerFilter.replace(/[^\w\u4e00-\u9fff]/g, "_")
    : null;
  const zipName = safeReviewer
    ? `annotations_${safeReviewer}.zip`
    : "annotations_all.zip";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
      "Cache-Control": "no-store",
    },
  });
}
