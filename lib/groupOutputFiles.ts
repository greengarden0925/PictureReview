import fs from "fs/promises";
import path from "path";
import type { GroupPayload, ImageSlot } from "./types";
import { getOutputRootDir, toPosixRelative } from "./paths";

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

/**
 * 由檔名取得 group key：去掉 _raw、_v1–_v3、_prompt、_review_report 後綴。
 */
export function getGroupKeyFromFilename(filename: string): string {
  const base = path.basename(filename);
  const ext = path.extname(base);
  let stem = base.slice(0, -ext.length);

  const strip = (re: RegExp): string | null => {
    const m = stem.match(re);
    return m ? m[1] : null;
  };

  const candidates = [
    strip(/^(.+)_raw$/i),
    strip(/^(.+)_v[123]$/i),
    strip(/^(.+)_prompt$/i),
    strip(/^(.+)_review_report$/i),
  ];
  for (const c of candidates) {
    if (c !== null) return c;
  }
  return stem;
}

function pickBest(
  candidates: string[],
  predicate: (name: string) => boolean
): string | null {
  const hits = candidates.filter(predicate).sort((a, b) => a.localeCompare(b));
  return hits[0] ?? null;
}

function slotNameForFile(filename: string, prefix: string): ImageSlot | null {
  const base = path.basename(filename);
  const ext = path.extname(base);
  const stem = base.slice(0, -ext.length);
  if (!IMAGE_EXTS.has(ext.toLowerCase())) return null;
  if (stem === `${prefix}_raw`) return "raw";
  if (stem === `${prefix}_v1`) return "v1";
  if (stem === `${prefix}_v2`) return "v2";
  if (stem === `${prefix}_v3`) return "v3";
  return null;
}

/**
 * 掃描 output 目錄（僅一層），依 prefix 分組並產出四格與附檔相對路徑。
 */
export async function scanOutputGroups(): Promise<GroupPayload[]> {
  const root = getOutputRootDir();
  let names: string[];
  try {
    names = await fs.readdir(root);
  } catch {
    return [];
  }

  const files = (
    await Promise.all(
      names.map(async (n) => {
        const full = path.join(root, n);
        const st = await fs.stat(full).catch(() => null);
        return st?.isFile() ? n : null;
      })
    )
  ).filter((x): x is string => x !== null);

  const byKey = new Map<string, string[]>();
  for (const f of files) {
    const key = getGroupKeyFromFilename(f);
    const arr = byKey.get(key) ?? [];
    arr.push(f);
    byKey.set(key, arr);
  }

  const slots: ImageSlot[] = ["raw", "v1", "v2", "v3"];
  const result: GroupPayload[] = [];

  for (const [groupKey, groupFiles] of byKey) {
    const rel = (fname: string) =>
      toPosixRelative(path.join(root, fname));

    const slotsOut: Record<ImageSlot, string | null> = {
      raw: null,
      v1: null,
      v2: null,
      v3: null,
    };

    for (const s of slots) {
      const found = pickBest(groupFiles, (name) => {
        return slotNameForFile(name, groupKey) === s;
      });
      if (found) slotsOut[s] = rel(found);
    }

    // 過濾：至少要有「原始圖」或「第一版圖」其中之一
    if (!slotsOut.raw && !slotsOut.v1) {
      continue;
    }

    const promptFile = pickBest(
      groupFiles,
      (n) =>
        n === `${groupKey}_prompt.txt` ||
        path.basename(n) === `${groupKey}_prompt.txt`
    );
    const reportFile = pickBest(
      groupFiles,
      (n) =>
        n === `${groupKey}_review_report.json` ||
        path.basename(n) === `${groupKey}_review_report.json`
    );

    result.push({
      groupKey,
      slots: slotsOut,
      promptRelativePath: promptFile ? rel(promptFile) : null,
      reviewReportRelativePath: reportFile ? rel(reportFile) : null,
    });
  }

  result.sort((a, b) => a.groupKey.localeCompare(b.groupKey, "zh-Hant"));
  return result;
}
