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

  const [data, survey] = await Promise.all([readReviews(), readSurvey()]);
  const qids = [...survey.questions]
    .sort((a, b) => a.order - b.order)
    .map((q) => q.id);

  const headers = [
    "reviewer",
    "groupKey",
    "submittedAt",
    "updatedAt",
    ...qids,
  ];

  const lines = [headers.map(escapeCsvCell).join(",")];

  for (const e of data.entries) {
    const row: string[] = [
      e.reviewerName,
      e.groupKey,
      e.submittedAt,
      e.updatedAt,
    ];
    for (const id of qids) {
      const val = e.answers[id];
      row.push(val === undefined || val === null ? "" : String(val));
    }
    lines.push(row.map(escapeCsvCell).join(","));
  }

  const csv = lines.join("\r\n") + "\r\n";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="reviews_export.csv"',
    },
  });
}
