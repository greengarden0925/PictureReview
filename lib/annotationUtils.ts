import path from "path";
import { getDataDir } from "@/lib/paths";

export function safeSegment(s: string): string {
  return s.replace(/[^\w\u4e00-\u9fff]/g, "_").replace(/_+/g, "_").trim();
}

export function annotationBasename(
  reviewer: string,
  groupKey: string,
  imageKey: string
): string {
  return `${safeSegment(reviewer)}__${safeSegment(groupKey)}__${imageKey}`;
}

export function annotationsDir(): string {
  return path.join(getDataDir(), "annotations");
}
