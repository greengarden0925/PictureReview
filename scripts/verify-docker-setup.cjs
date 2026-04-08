/**
 * 在執行 docker compose 前檢查本機檔案與（可選）Docker 引擎是否可用。
 * 用法：node scripts/verify-docker-setup.cjs
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const issues = [];
const ok = [];

function check(name, pass, detail) {
  if (pass) ok.push(name);
  else issues.push({ name, detail });
}

const htpasswd = path.join(root, "deploy", "nginx", ".htpasswd");
if (!fs.existsSync(htpasswd)) {
  check("deploy/nginx/.htpasswd", false, "檔案不存在；請 npm run gen-htpasswd 產生");
} else {
  const buf = fs.readFileSync(htpasswd);
  check(
    "deploy/nginx/.htpasswd 非空",
    buf.length > 0,
    "檔案為空"
  );
  check(
    "deploy/nginx/.htpasswd 無 UTF-8 BOM",
    !(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf),
    "含 BOM 可能導致 Nginx 驗證失敗；請用 cmd 重導向或儲存為 UTF-8 無 BOM"
  );
  const looksUtf16Le =
    (buf[0] === 0xff && buf[1] === 0xfe) ||
    (buf.length >= 4 &&
      buf[1] === 0 &&
      buf[3] === 0 &&
      buf[0] >= 0x20 &&
      buf[0] < 0x7f);
  check(
    "deploy/nginx/.htpasswd 非 UTF-16",
    !looksUtf16Le,
    "檔案為 UTF-16 時 Nginx 無法驗證（常見：用記事本或 IDE 存檔）。請執行：npm run write-htpasswd -- 使用者 密碼"
  );
  const text = buf.toString("utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const validLine = /^[^:\s]+:.+$/;
  const badLines = lines.filter((l) => !validLine.test(l));
  check(
    ".htpasswd 每行皆為「使用者:雜湊」",
    badLines.length === 0,
    `含無效行（常見：曾用 npm run ... > 寫檔混進標頭）。請改為：node scripts/generate-htpasswd.cjs 使用者 密碼 > deploy/nginx/.htpasswd。問題行：${badLines
      .slice(0, 3)
      .map((s) => JSON.stringify(s.slice(0, 60)))
      .join(", ")}`
  );
}

const outDir = path.join(root, "docker-data", "output");
check(
  "docker-data/output 目錄存在",
  fs.existsSync(outDir) && fs.statSync(outDir).isDirectory(),
  "請將父專案 output/ 複製到 docker-data/output/"
);
if (fs.existsSync(outDir)) {
  const entries = fs.readdirSync(outDir);
  check(
    "docker-data/output 有檔案",
    entries.length > 0,
    "目錄為空，審查頁會沒有圖組"
  );
}

check(
  "package-lock.json 存在（Dockerfile 使用 npm ci）",
  fs.existsSync(path.join(root, "package-lock.json")),
  "請在專案根執行 npm install 產生 lock 檔"
);

let dockerOk = false;
try {
  execSync("docker info", { stdio: "pipe", timeout: 15000 });
  dockerOk = true;
  ok.push("Docker 引擎可連線（docker info）");
} catch (e) {
  issues.push({
    name: "Docker 引擎",
    detail:
      "無法執行 docker info。請啟動 Docker Desktop（Windows）或 docker 服務後再試。",
  });
}

console.log("=== PictureReview Docker 前置檢查 ===\n");
if (ok.length) {
  console.log("[通過]");
  ok.forEach((m) => console.log("  ✓", m));
}
if (issues.length) {
  console.log("\n[待處理]");
  issues.forEach(({ name, detail }) => console.log("  ✗", name, "\n    →", detail));
}
console.log(
  "\n映像內建置等同執行 npm ci && npm run build；本機可先跑 npm run build 驗證 Next 能否編譯成功。"
);

process.exit(issues.length ? 1 : 0);
