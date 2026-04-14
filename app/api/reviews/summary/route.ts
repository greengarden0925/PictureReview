import { NextResponse } from "next/server";
import { readReviews } from "@/lib/jsonStore";
import { readAssignment } from "@/lib/assignmentStore";

export const dynamic = "force-dynamic";

export type ReviewerSummary = {
  name: string;
  totalAssigned: number;
  completed: number;
  lastUpdatedAt: string | null;
};

export async function GET() {
  const [reviewsData, assignment] = await Promise.all([
    readReviews(),
    readAssignment(),
  ]);

  if (!assignment) {
    return NextResponse.json({ error: "尚未設定分配" }, { status: 404 });
  }

  const summaries: ReviewerSummary[] = Object.entries(
    assignment.reviewerGroups
  ).map(([name, groups]) => {
    const submittedGroupKeys = new Set(
      reviewsData.entries
        .filter((e) => e.reviewerName === name)
        .map((e) => e.groupKey)
    );

    const completed = groups.filter((g) => submittedGroupKeys.has(g)).length;

    const lastEntry = reviewsData.entries
      .filter((e) => e.reviewerName === name)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;

    return {
      name,
      totalAssigned: groups.length,
      completed,
      lastUpdatedAt: lastEntry?.updatedAt ?? null,
    };
  });

  summaries.sort((a, b) => a.name.localeCompare(b.name));

  const totalCompleted = summaries.reduce((s, r) => s + r.completed, 0);
  const totalAssigned = summaries.reduce((s, r) => s + r.totalAssigned, 0);

  return NextResponse.json({ summaries, totalCompleted, totalAssigned });
}
