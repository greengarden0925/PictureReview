import { NextResponse } from "next/server";
import { readReviews, readSurvey } from "@/lib/jsonStore";

export const dynamic = "force-dynamic";

function escapeCsvCell(v: string): string {
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "csv";
  if (format !== "csv") {
    return NextResponse.json({ error: "only csv supported" }, { status: 400 });
  }

  const reviewerFilter = url.searchParams.get("reviewerName")?.trim() ?? null;

  const [data, survey] = await Promise.all([readReviews(), readSurvey()]);

  const sortedQuestions = [...survey.questions].sort(
    (a, b) => a.order - b.order
  );
  const nonCompareQuestions = sortedQuestions.filter(
    (q) => q.type !== "compare"
  );
  const compareQuestion =
    sortedQuestions.find((q) => q.type === "compare") ?? null;

  // 欄位順序：q1_A, q1_B, q2_A, q2_B, …, q_compare
  const answerColumns: string[] = [];
  for (const q of nonCompareQuestions) {
    answerColumns.push(`${q.id}_A`);
    answerColumns.push(`${q.id}_B`);
  }
  if (compareQuestion) {
    answerColumns.push(compareQuestion.id);
  }

  const headers = [
    "reviewer",
    "groupKey",
    "submittedAt",
    "updatedAt",
    ...answerColumns,
  ];

  const lines = [headers.map(escapeCsvCell).join(",")];

  const entries = reviewerFilter
    ? data.entries.filter((e) => e.reviewerName === reviewerFilter)
    : data.entries;

  for (const e of entries) {
    const row: string[] = [
      e.reviewerName,
      e.groupKey,
      e.submittedAt,
      e.updatedAt,
    ];
    for (const id of answerColumns) {
      const val = e.answers[id];
      row.push(val === undefined || val === null ? "" : String(val));
    }
    lines.push(row.map(escapeCsvCell).join(","));
  }

  const csv = lines.join("\r\n") + "\r\n";
  const safeReviewer = reviewerFilter
    ? reviewerFilter.replace(/[^\w\u4e00-\u9fff-]/g, "_")
    : null;
  const filename = safeReviewer
    ? `reviews_${safeReviewer}.csv`
    : "reviews_export.csv";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
