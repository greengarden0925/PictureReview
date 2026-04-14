import { NextResponse } from "next/server";
import { readAssignment, writeAssignment } from "@/lib/assignmentStore";
import { scanOutputGroups } from "@/lib/groupOutputFiles";
import { generateAssignment, computeCoverage, validateAssignmentParams } from "@/lib/bibd";
import { isAdminAuthorized } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

/** GET /api/assignment — 回傳目前分配結果 + 覆蓋率統計 */
export async function GET() {
  const assignment = await readAssignment();
  if (!assignment) {
    return NextResponse.json({ assignment: null });
  }

  const groups = await scanOutputGroups();
  const allGroupKeys = groups.map((g) => g.groupKey);
  const coverage = computeCoverage(assignment, allGroupKeys);

  return NextResponse.json({ assignment, coverage });
}

/** POST /api/assignment — 生成新分配（需 admin 權限） */
export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  let body: { n?: unknown; m?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const n = Number(body.n);
  const m = Number(body.m);

  const groups = await scanOutputGroups();
  const groupKeys = groups.map((g) => g.groupKey);
  const v = groupKeys.length;

  if (v === 0) {
    return NextResponse.json({ error: "output 目錄中沒有可分組的圖檔" }, { status: 400 });
  }

  const { ok, errors } = validateAssignmentParams(v, n, m);
  if (!ok) {
    return NextResponse.json({ error: errors.join("；") }, { status: 400 });
  }

  const assignment = generateAssignment(groupKeys, n, m);
  await writeAssignment(assignment);

  const coverage = computeCoverage(assignment, groupKeys);
  return NextResponse.json({ ok: true, assignment, coverage });
}
