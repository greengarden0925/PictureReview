import fs from "fs/promises";
import path from "path";
import type { AssignmentData } from "./types";
import { getDataDir } from "./paths";

const assignmentPath = () => path.join(getDataDir(), "assignment.json");

export async function readAssignment(): Promise<AssignmentData | null> {
  try {
    const raw = await fs.readFile(assignmentPath(), "utf-8");
    return JSON.parse(raw) as AssignmentData;
  } catch {
    return null;
  }
}

export async function writeAssignment(data: AssignmentData): Promise<void> {
  const p = assignmentPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmp, p);
}
