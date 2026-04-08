# PictureReview（圖片審查 Webtool）

完整架構與 API 說明見 **[project design.md](project%20design.md)**。  
**審查者操作步驟、是否需安裝 Docker、管理員環境設定** 見 **[Reviewer使用說明.md](./Reviewer使用說明.md)**。

獨立於父目錄 Python 流程的 Next.js 審查介面。請先將父專案產出同步到本專案（見下），再以 API 讀取 **`public/output/`**（或 `PICTURE_REVIEW_OUTPUT_DIR` 覆寫路徑）。

**資料約定**：Python 流程產生的**所有圖片**與**相關資料檔**（如 `*_prompt.txt`、`*_review_report.json` 等）先寫在父專案 **`output/`**；審查工具以 `npm run sync-output` **整份複製**到本專案 **`public/output/`**（不納入 Git）。審查問卷與填答結果預設存在本專案 **`data/`**；可用環境變數 **`PICTURE_REVIEW_DATA_DIR`** 改為任意路徑（例如 Docker 掛載 `/data`）。

## 推薦：Docker + 網址（多人審查最單純）

審查者**不用安裝 Node**、不用複製專案：管理員在主機（或 VM）用 Docker 跑起服務後，把 **網址** 與 **Nginx 帳密** 給審查者即可。

**審查者三步驟：**

1. 用瀏覽器開啟你提供的網址（例如 `http://主機:8080`）。
2. 在跳出視窗輸入 **HTTP 帳號／密碼**（密碼是當初設定的**明文**，不是 `.htpasswd` 裡的 `$2a$10$...` 雜湊）。
3. 進站後再填 **審查者名稱**（用於寫入審查紀錄），即可開始審圖。

**管理員概要：** 產生 `deploy/nginx/.htpasswd` → 準備 `docker-data/output/`（內容同父專案 `output/`）→ `docker compose up -d --build`。完整指令與除錯見下方 **「Docker 部署詳細步驟」**。

---

## 本機開發（維護專案用）

- **Node.js** 18.17+（見 `package.json` 的 `engines`）
- 選用：複製 `.env.local.example` 為 `.env.local`；可設 `PICTURE_REVIEW_OUTPUT_DIR`、`PICTURE_REVIEW_DATA_DIR`。

若未設定 `PICTURE_REVIEW_ADMIN_TOKEN`，問卷管理 API 預設允許寫入（**僅建議本機**）。上線／Docker 請設定 token。

```bash
npm install
npm run sync-output   # 將父專案 output/ 複製到 public/output/
npm run dev
```

瀏覽器開啟 `http://localhost:3000`。

---

## Docker 部署詳細步驟（Nginx Basic Auth）

1. **產生密碼檔**（寫入 `deploy/nginx/.htpasswd`，已列於 `.gitignore`）：

   **建議（Windows 最穩）**：用腳本直接寫入 **UTF-8**，避免記事本／IDE 存成 **UTF-16** 或 `npm run ... >` 混入標頭（兩者都會導致 Nginx **401**）：

   ```bash
   npm run write-htpasswd -- reviewer 你的密碼
   ```

   亦可：`node scripts/generate-htpasswd.cjs reviewer 你的密碼 > deploy/nginx/.htpasswd`（請用 **cmd** 重導向，勿用 PowerShell `>` 以免 UTF-16）。

   （Linux 亦可：`docker run --rm httpd:2.4-alpine htpasswd -nbB reviewer 你的密碼 > deploy/nginx/.htpasswd`）

2. **準備圖檔與資料**：在專案根目錄建立 `docker-data/output/`，將父專案 **`output/`** 整份複製進去（內容等同本機的 `public/output/`）。

3. **啟動**（需 Docker；對外埠預設 `8080`）：

   ```bash
   docker compose up -d --build
   ```

   瀏覽 `http://<主機>:8080`，瀏覽器會要求 Basic Auth；通過後再使用站內審查者名稱登入即可。

4. **持久化**：`survey.json` / `reviews.json` 寫在容器內 **`/data`**，對應主機 **`./docker-data/`**（已列於 `.gitignore`）。圖檔讀 **`/data/output`**（即 `./docker-data/output`）。

5. **問卷管理 API**：上線請設定 **`PICTURE_REVIEW_ADMIN_TOKEN`**（見 `.env.local.example`），避免他人改問卷設定；Nginx 只擋「沒帳密的人」，不取代管理 token。

6. **HTTPS**：Basic Auth 密碼以明文送網路，**正式環境請在前面加 TLS**（例如主機再掛 Nginx + Let’s Encrypt、或雲端 Load Balancer 終止 HTTPS）。

### Docker 除錯與確認可否執行

1. **本機先檢查**（不需容器已起動）：

   ```bash
   npm run docker:check
   ```

   會檢查 `deploy/nginx/.htpasswd`、`docker-data/output`、lock 檔，並嘗試 `docker info` 確認引擎已連線。

2. **`error during connect` / `dockerDesktopLinuxEngine`**：代表 **Docker Desktop 未開** 或後端未就緒；請先啟動 Docker Desktop，等托盤圖示顯示 running 後再執行 `docker compose up -d --build`。

3. **建置失敗**：在 `PictureReview` 執行 `npm run build`；若本機可過，Dockerfile 內 `npm run build` 通常也可過（環境為 Linux + Node 20）。

4. **Nginx 502 / 一直重啟 / 401**：看 `docker compose logs nginx`。`.htpasswd` 必須**只有一行** `使用者:雜湊`；勿用 `npm run ... >` 重導向（會混入 npm 標頭導致 401）。請用：`node scripts/generate-htpasswd.cjs user pass > deploy/nginx/.htpasswd`。另注意 PowerShell 勿寫成 UTF-16。

5. **驗證服務**：`docker compose ps` 兩個服務皆 `running` 後，用瀏覽器或 `curl.exe -u 帳:密 http://localhost:8080/api/groups` 測試（PowerShell 請用 `curl.exe`，勿用別名 `curl`）。

---

## 備選：審查者本機雙擊（無 Docker／單人離線時）

與 **Docker + 網址擇一** 即可；多人遠端仍以 Docker 為主。

審查者需先安裝 **Node.js 18+**，再雙擊 **`Launch-PictureReview.cmd`**（會自動安裝套件、同步、建置、開瀏覽器）。關閉黑底視窗即停止服務。

若要把 `.cmd` 包成 `.exe`，可用可信的「Bat 轉 Exe」工具（**仍須本機已裝 Node**）；或自行用 Inno Setup／NSIS 做安裝程式，一併帶入 Node LTS 與桌面捷徑。

## 套件版本

見 `package.json`（Next 14.2.x、React 18.3.x、Tailwind 3.4.x、TypeScript 5.6.x、bcryptjs 2.4.x）。
