/**
 * 將父專案根目錄的 output/ 整份複製到本專案 public/output/
 * 需 Node.js 18+（fs.cp）
 *
 * 用法：在 PictureReview 目錄執行 npm run sync-output
 */
const fs = require("fs/promises");
const path = require("path");

async function main() {
  const pictureReviewRoot = path.resolve(__dirname, "..");
  const parentOutput = path.resolve(pictureReviewRoot, "..", "output");
  const dest = path.join(pictureReviewRoot, "public", "output");

  let srcStat;
  try {
    srcStat = await fs.stat(parentOutput);
  } catch {
    console.error(
      `[sync-output] 找不到來源目錄：\n  ${parentOutput}\n請確認父專案已建立 output 資料夾。`
    );
    process.exit(1);
  }
  if (!srcStat.isDirectory()) {
    console.error(`[sync-output] 來源不是資料夾：${parentOutput}`);
    process.exit(1);
  }

  await fs.rm(dest, { recursive: true, force: true });
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.cp(parentOutput, dest, { recursive: true });

  console.log(`[sync-output] 已複製\n  來源：${parentOutput}\n  目的：${dest}`);
}

main().catch((e) => {
  console.error("[sync-output] 失敗：", e);
  process.exit(1);
});
