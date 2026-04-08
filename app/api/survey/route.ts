import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/adminAuth";
import { readSurvey, writeSurvey } from "@/lib/jsonStore";
import type { SurveyConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const survey = await readSurvey();
  return NextResponse.json(survey);
}

export async function PUT(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: SurveyConfig;
  try {
    body = (await request.json()) as SurveyConfig;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body || typeof body.version !== "number" || !Array.isArray(body.questions)) {
    return NextResponse.json({ error: "invalid survey shape" }, { status: 400 });
  }
  await writeSurvey(body);
  return NextResponse.json({ ok: true });
}
