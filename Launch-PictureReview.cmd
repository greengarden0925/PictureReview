@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo === PictureReview 圖片審查 ===
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [錯誤] 找不到 Node.js。
  echo 請先安裝 Node.js 18 以上（長期支援版即可）：https://nodejs.org/
  echo 安裝時勾選「Add to PATH」，完成後再雙擊本檔案。
  echo.
  pause
  exit /b 1
)

echo [1/4] 檢查 npm 套件…
if not exist "node_modules\" (
  call npm install
  if errorlevel 1 (
    echo 安裝失敗。
    pause
    exit /b 1
  )
)

if exist "%~dp0..\output\" (
  echo [2/4] 自旁邊父專案同步圖檔到 public\output …
  call npm run sync-output
  if errorlevel 1 (
    echo （同步失敗，若 public\output 已有圖檔可忽略。）
  )
) else (
  echo [2/4] 略過同步（未找到 ..\output，請確認圖檔已在 public\output）。
)

if not exist ".next\BUILD_ID" (
  echo [3/4] 首次建置中，約 1～3 分鐘，請稍候…
  call npm run build
  if errorlevel 1 (
    echo 建置失敗。
    pause
    exit /b 1
  )
) else (
  echo [3/4] 建置已存在，略過。
)

echo [4/4] 啟動中… 數秒後會開啟瀏覽器。
echo        網址：http://127.0.0.1:3000
echo        關閉本黑底視窗即停止服務。
echo.
start "" cmd /c "ping -n 6 127.0.0.1 ^>nul ^& start \"\" http://127.0.0.1:3000/"

call npm run start
echo.
pause
