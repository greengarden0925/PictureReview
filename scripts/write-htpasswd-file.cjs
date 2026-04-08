/**
 * 以 UTF-8（無 BOM）寫入 deploy/nginx/.htpasswd，避免 PowerShell / 編輯器存成 UTF-16。
 * 用法：node scripts/write-htpasswd-file.cjs <使用者> <密碼> [輸出路徑]
 */
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const user = process.argv[2];
const pass = process.argv[3];
const out =
  process.argv[4] ||
  path.join(__dirname, "..", "deploy", "nginx", ".htpasswd");

if (!user || !pass) {
  console.error(
    "用法: node scripts/write-htpasswd-file.cjs <使用者> <密碼> [輸出路徑]"
  );
  process.exit(1);
}

const line = `${user}:${bcrypt.hashSync(pass, 10)}\n`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, line, { encoding: "utf8" });
console.error("已寫入 UTF-8:", out);
