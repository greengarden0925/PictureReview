import fs from "fs/promises";
import path from "path";
import type { ReviewsFile, SurveyConfig } from "./types";
import { getDataDir } from "./paths";

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function atomicWriteJson(filePath: string, data: unknown) {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  const payload = JSON.stringify(data, null, 2);
  const tmp = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );
  await fs.writeFile(tmp, payload, "utf-8");
  await fs.rename(tmp, filePath);
}

const surveyPath = () => path.join(getDataDir(), "survey.json");
const reviewsPath = () => path.join(getDataDir(), "reviews.json");

export const defaultSurvey: SurveyConfig = {
  version: 1,
  questions: [
    {
      id: "q1",
      type: "likert",
      label: "圖示清晰度",
      order: 0,
    },
    {
      id: "q2",
      type: "open",
      label: "其他建議",
      order: 1,
    },
  ],
};

export async function readSurvey(): Promise<SurveyConfig> {
  try {
    const raw = await fs.readFile(surveyPath(), "utf-8");
    return JSON.parse(raw) as SurveyConfig;
  } catch {
    await writeSurvey(defaultSurvey);
    return defaultSurvey;
  }
}

export async function writeSurvey(cfg: SurveyConfig): Promise<void> {
  await atomicWriteJson(surveyPath(), cfg);
}

export async function readReviews(): Promise<ReviewsFile> {
  try {
    const raw = await fs.readFile(reviewsPath(), "utf-8");
    return JSON.parse(raw) as ReviewsFile;
  } catch {
    const empty: ReviewsFile = { entries: [] };
    await atomicWriteJson(reviewsPath(), empty);
    return empty;
  }
}

export async function writeReviews(data: ReviewsFile): Promise<void> {
  await atomicWriteJson(reviewsPath(), data);
}
