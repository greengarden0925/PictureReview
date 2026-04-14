export type QuestionType = "likert" | "open" | "compare";

export type SurveyQuestion = {
  id: string;
  type: QuestionType;
  label: string;
  order: number;
};

export type SurveyConfig = {
  version: number;
  questions: SurveyQuestion[];
};

export type ReviewEntry = {
  reviewerName: string;
  groupKey: string;
  answers: Record<string, number | string>;
  submittedAt: string;
  updatedAt: string;
};

export type ReviewsFile = {
  entries: ReviewEntry[];
};

export type ImageSlot = "raw" | "v1" | "v2" | "v3";

export type AssignmentData = {
  n: number;
  m: number;
  totalGroups: number;
  generatedAt: string;
  /** reviewer name → array of assigned group keys */
  reviewerGroups: Record<string, string[]>;
};

export type GroupPayload = {
  groupKey: string;
  slots: Record<ImageSlot, string | null>;
  promptRelativePath: string | null;
  reviewReportRelativePath: string | null;
};
