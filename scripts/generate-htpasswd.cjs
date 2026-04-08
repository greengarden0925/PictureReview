/**
 * 產生 Nginx Basic Auth 的 htpasswd 一行（bcrypt）。
 * 用法：node scripts/generate-htpasswd.cjs <使用者名稱> <密碼>
 * 範例：node scripts/generate-htpasswd.cjs reviewer mypass > deploy/nginx/.htpasswd
 */
const bcrypt = require("bcryptjs");

const user = process.argv[2] || "reviewer";
const pass = process.argv[3];
if (!pass) {
  console.error("用法: node scripts/generate-htpasswd.cjs <使用者> <密碼>");
  process.exit(1);
}

const hash = bcrypt.hashSync(pass, 10);
process.stdout.write(`${user}:${hash}\n`);
