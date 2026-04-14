import { NextResponse } from "next/server";
import { scanOutputGroups } from "@/lib/groupOutputFiles";
import { readAssignment } from "@/lib/assignmentStore";

export const dynamic = "force-dynamic";

/**
 * GET /api/groups?reviewer=<name>
 *
 * 若有傳 reviewer 且 assignment 中有此審查員，只回傳其被分配的組。
 * 若 reviewer 不在 assignment 中（例如管理員），回傳全部組。
 * 若無 reviewer 參數，回傳全部組。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const reviewer = url.searchParams.get("reviewer")?.trim() ?? null;

  try {
    const groups = await scanOutputGroups();

    if (reviewer) {
      const assignment = await readAssignment();
      const assignedKeys = assignment?.reviewerGroups[reviewer];
      if (assignedKeys && assignedKeys.length > 0) {
        const keySet = new Set(assignedKeys);
        // 保留原始排序（按 groupKey 排序），只留分配到的組
        const filtered = groups.filter((g) => keySet.has(g.groupKey));
        // 依分配清單順序排列，方便審查員按順序審查
        filtered.sort(
          (a, b) => assignedKeys.indexOf(a.groupKey) - assignedKeys.indexOf(b.groupKey)
        );
        return NextResponse.json({ groups: filtered });
      }
    }

    return NextResponse.json({ groups });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "scan failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
