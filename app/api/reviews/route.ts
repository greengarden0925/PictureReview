import { NextResponse } from "next/server";
import { readReviews, writeReviews } from "@/lib/jsonStore";
import type { ReviewEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reviewerName = url.searchParams.get("reviewerName")?.trim();
  const groupKey = url.searchParams.get("groupKey")?.trim();

  if (!reviewerName || !groupKey) {
    return NextResponse.json(
      { error: "reviewerName and groupKey required" },
      { status: 400 }
    );
  }

  const data = await readReviews();
  const found =
    data.entries.find(
      (e) => e.reviewerName === reviewerName && e.groupKey === groupKey
    ) ?? null;
  return NextResponse.json({ entry: found });
}

export async function POST(request: Request) {
  let body: {
    reviewerName?: string;
    groupKey?: string;
    answers?: Record<string, number | string>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const reviewerName = body.reviewerName?.trim();
  const groupKey = body.groupKey?.trim();
  const answers = body.answers;

  if (!reviewerName || !groupKey || !answers || typeof answers !== "object") {
    return NextResponse.json(
      { error: "reviewerName, groupKey, answers required" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const data = await readReviews();
  const idx = data.entries.findIndex(
    (e) => e.reviewerName === reviewerName && e.groupKey === groupKey
  );

  const entry: ReviewEntry = {
    reviewerName,
    groupKey,
    answers,
    submittedAt:
      idx >= 0 ? data.entries[idx].submittedAt : now,
    updatedAt: now,
  };

  if (idx >= 0) {
    data.entries[idx] = entry;
  } else {
    data.entries.push(entry);
  }

  await writeReviews(data);
  return NextResponse.json({ ok: true, entry });
}
