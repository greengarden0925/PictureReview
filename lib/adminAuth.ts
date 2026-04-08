/**
 * 管理者 API：環境變數 PICTURE_REVIEW_ADMIN_TOKEN 未設定時允許寫入（僅建議本機使用）；
 * 有設定時須 Bearer 或 ?token=
 */
export function isAdminAuthorized(request: Request): boolean {
  const token = process.env.PICTURE_REVIEW_ADMIN_TOKEN?.trim();
  if (!token) return true;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${token}`) return true;

  const url = new URL(request.url);
  if (url.searchParams.get("token") === token) return true;

  return false;
}
