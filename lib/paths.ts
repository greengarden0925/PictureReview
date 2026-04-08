import fs from "fs";
import path from "path";

/**
 * 審查用圖片與附檔根目錄。
 * 預設為本專案 `public/output/`（由 `npm run sync-output` 自父專案 `output/` 複製而來）。
 * 可設 PICTURE_REVIEW_OUTPUT_DIR 覆寫為其他絕對或相對路徑。
 */
export function getOutputRootDir(): string {
  const fromEnv = process.env.PICTURE_REVIEW_OUTPUT_DIR?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.resolve(process.cwd(), fromEnv);
  }
  return path.resolve(process.cwd(), "public", "output");
}

/**
 * 問卷與審查結果等 JSON 的存放根目錄。
 * 預設為本專案 `data/`；Docker 建議設 `PICTURE_REVIEW_DATA_DIR=/data` 並掛 volume。
 */
export function getDataDir(): string {
  const fromEnv = process.env.PICTURE_REVIEW_DATA_DIR?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.resolve(process.cwd(), fromEnv);
  }
  return path.join(process.cwd(), "data");
}

function normalizeRelativeInput(rel: string): string {
  const decoded = decodeURIComponent(rel.trim());
  const forward = decoded.replace(/\\/g, "/");
  const parts = forward.split("/").filter((p) => p !== "" && p !== ".");
  if (parts.some((p) => p === "..")) {
    throw new Error("path traversal");
  }
  return parts.join(path.sep);
}

/**
 * 將相對於 output 根目錄的路徑解析為絕對路徑，並確認落在根目錄內（防 path traversal）。
 * 不要求檔案已存在（避免 realpath 失敗）。
 */
export function resolveSafeOutputRelative(rel: string): string {
  const root = path.resolve(getOutputRootDir());
  let rootReal: string;
  try {
    rootReal = fs.realpathSync(root);
  } catch {
    rootReal = root;
  }
  const normalized = normalizeRelativeInput(rel);
  const abs = path.resolve(rootReal, normalized);
  const relToRoot = path.relative(rootReal, abs);
  if (relToRoot.startsWith("..") || path.isAbsolute(relToRoot)) {
    throw new Error("outside output root");
  }
  return abs;
}

/** API／前端傳遞用：一律使用正斜線 */
export function toPosixRelative(absUnderRoot: string): string {
  const root = path.resolve(getOutputRootDir());
  let rootReal: string;
  try {
    rootReal = fs.realpathSync(root);
  } catch {
    rootReal = root;
  }
  const absReal = (() => {
    try {
      return fs.realpathSync(absUnderRoot);
    } catch {
      return absUnderRoot;
    }
  })();
  const rel = path.relative(rootReal, absReal);
  return rel.split(path.sep).join("/");
}
