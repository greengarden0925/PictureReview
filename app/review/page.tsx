"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { GroupPayload, SurveyConfig, SurveyQuestion } from "@/lib/types";
import { CommandHistory, makeSetAnswerCommand } from "@/lib/commandHistory";
import { ImageAnnotator } from "./ImageAnnotator";

const REVIEWER_KEY = "reviewerName";
const INDEX_KEY = "pictureReviewGroupIndex";

// 從 slots 取得最新版本圖（v3 > v2 > v1）
function getLatestVersionSlot(
  slots: GroupPayload["slots"]
): string | null {
  return slots.v3 ?? slots.v2 ?? slots.v1 ?? null;
}

function assetUrl(rel: string | null) {
  if (!rel) return null;
  return `/api/asset?path=${encodeURIComponent(rel)}`;
}

function ImageLightbox({
  open,
  src,
  title,
  onClose,
}: {
  open: boolean;
  src: string | null;
  title: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !src) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/88 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`放大預覽：${title}`}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-zoom-out"
        aria-label="關閉預覽"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[92vh] max-w-[96vw] flex-col items-center">
        <div className="mb-2 flex w-full items-center justify-between gap-3 px-1">
          <p className="truncate text-center text-sm font-medium text-white/90">
            {title}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
          >
            關閉
          </button>
        </div>
        <div className="relative max-h-[calc(92vh-3rem)] max-w-full overflow-auto rounded-lg border border-white/15 bg-black/40 p-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={title}
            className="max-h-[min(85vh,calc(92vh-3rem))] w-auto max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <p className="mt-2 text-center text-xs text-white/50">
          點擊深色背景或按 Esc 關閉
        </p>
      </div>
    </div>
  );
}

function SlotImage({
  rel,
  label,
  badge,
  onOpenPreview,
}: {
  rel: string | null;
  label: string;
  badge?: string;
  onOpenPreview: (imageUrl: string, imageTitle: string) => void;
}) {
  const url = assetUrl(rel);
  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-2 flex items-center justify-center gap-2">
        <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
        {badge && (
          <span className="rounded bg-[var(--accent)]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
            {badge}
          </span>
        )}
      </div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-[var(--border)] bg-black/40">
        {url ? (
          <button
            type="button"
            className="group relative h-full w-full p-0 text-left"
            onClick={() => onOpenPreview(url, label)}
            title="點擊放大預覽"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={label}
              className="h-full w-full object-contain transition-opacity group-hover:opacity-95"
            />
            <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white/95">
              點擊放大
            </span>
          </button>
        ) : (
          <div className="flex h-full min-h-[120px] items-center justify-center px-2 text-center text-sm text-[var(--muted)]">
            沒有此圖片
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Compare question options ───────────────────────────────────────────────
const COMPARE_OPTIONS = ["A圖", "B圖", "兩者差不多"] as const;
type CompareOption = (typeof COMPARE_OPTIONS)[number];

// ─── Collapsible survey panel for a single image (A or B) ──────────────────
function CollapsibleSurveyPanel({
  title,
  suffix,
  questions,
  answers,
  onSetAnswer,
}: {
  title: string;
  suffix: "_A" | "_B";
  questions: SurveyQuestion[];
  answers: Record<string, number | string>;
  onSetAnswer: (id: string, value: number | string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-[var(--muted)]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-[var(--border)] p-4">
          <div className="flex flex-col gap-5">
            {questions.map((q) => {
              const answerId = `${q.id}${suffix}`;
              return (
                <div key={q.id}>
                  <label className="mb-2 block text-sm font-medium">
                    {q.label}
                  </label>
                  {q.type === "likert" && (
                    <div className="flex flex-wrap gap-3">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <label
                          key={v}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <input
                            type="radio"
                            name={answerId}
                            checked={answers[answerId] === v}
                            onChange={() => onSetAnswer(answerId, v)}
                          />
                          {v}
                        </label>
                      ))}
                      <span className="ml-2 text-xs text-[var(--muted)]">
                        （1 = 非常不同意　5 = 非常同意）
                      </span>
                    </div>
                  )}
                  {q.type === "open" && (
                    <textarea
                      className="min-h-[80px] w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 text-sm text-[var(--text)]"
                      value={String(answers[answerId] ?? "")}
                      onChange={(e) => onSetAnswer(answerId, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReviewPage() {
  const router = useRouter();
  const [reviewerName, setReviewerName] = useState<string | null>(null);
  const [groups, setGroups] = useState<GroupPayload[]>([]);
  const [survey, setSurvey] = useState<SurveyConfig | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ src: string; title: string } | null>(
    null
  );

  // ── Command Pattern ─────────────────────────────────────────────────────
  const cmdHistory = useRef(new CommandHistory());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncHistoryState = useCallback(() => {
    setCanUndo(cmdHistory.current.canUndo);
    setCanRedo(cmdHistory.current.canRedo);
  }, []);

  // answers ref lets Command closures read the current value at dispatch time
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  function dispatchSetAnswer(id: string, value: number | string) {
    const prev = answersRef.current[id];
    const cmd = makeSetAnswerCommand(id, value, prev, setAnswers);
    cmdHistory.current.execute(cmd);
    syncHistoryState();
  }

  function handleUndo() {
    cmdHistory.current.undo();
    syncHistoryState();
  }

  function handleRedo() {
    cmdHistory.current.redo();
    syncHistoryState();
  }

  // ── Load reviewer ───────────────────────────────────────────────────────
  useEffect(() => {
    const n =
      typeof window !== "undefined"
        ? localStorage.getItem(REVIEWER_KEY)?.trim()
        : null;
    if (!n) {
      router.replace("/login");
      return;
    }
    setReviewerName(n);
  }, [router]);

  // ── Load groups + survey ────────────────────────────────────────────────
  useEffect(() => {
    if (!reviewerName) return;
    let cancelled = false;
    (async () => {
      try {
        const groupsUrl = `/api/groups?reviewer=${encodeURIComponent(reviewerName)}`;
        const [gr, sv] = await Promise.all([
          fetch(groupsUrl).then((r) => r.json()),
          fetch("/api/survey").then((r) => r.json()),
        ]);
        if (cancelled) return;
        setGroups(gr.groups ?? []);
        setSurvey(sv);
        const saved = sessionStorage.getItem(INDEX_KEY);
        const i = saved ? parseInt(saved, 10) : 0;
        if (!Number.isNaN(i) && i >= 0 && i < (gr.groups?.length ?? 0)) {
          setIndex(i);
        }
        setLoadErr(null);
      } catch {
        if (!cancelled) setLoadErr("無法載入資料");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reviewerName]);

  const current = groups[index] ?? null;

  const sortedQuestions: SurveyQuestion[] = useMemo(() => {
    if (!survey) return [];
    return [...survey.questions].sort((a, b) => a.order - b.order);
  }, [survey]);

  // 非比較題目（A、B各自作答）
  const nonCompareQuestions = useMemo(
    () => sortedQuestions.filter((q) => q.type !== "compare"),
    [sortedQuestions]
  );

  // 比較題目（一組只問一次）
  const compareQuestion = useMemo(
    () => sortedQuestions.find((q) => q.type === "compare") ?? null,
    [sortedQuestions]
  );

  // ── Load saved answers for current group ────────────────────────────────
  const loadAnswersForGroup = useCallback(
    async (g: GroupPayload | null) => {
      if (!reviewerName || !g) {
        setAnswers({});
        return;
      }
      const u = new URL("/api/reviews", window.location.origin);
      u.searchParams.set("reviewerName", reviewerName);
      u.searchParams.set("groupKey", g.groupKey);
      const res = await fetch(u.toString());
      const data = await res.json();
      const entry = data.entry as {
        answers?: Record<string, number | string>;
      } | null;
      setAnswers(entry?.answers ? { ...entry.answers } : {});
    },
    [reviewerName]
  );

  useEffect(() => {
    if (!current) return;
    loadAnswersForGroup(current);
    // Clear undo/redo history when switching groups
    cmdHistory.current.clear();
    syncHistoryState();
  }, [current, loadAnswersForGroup, syncHistoryState]);

  useEffect(() => {
    sessionStorage.setItem(INDEX_KEY, String(index));
  }, [index]);

  useEffect(() => {
    setIndex((i) => {
      if (groups.length === 0) return 0;
      return Math.min(Math.max(0, i), groups.length - 1);
    });
  }, [groups.length]);

  useEffect(() => {
    setPreview(null);
  }, [index]);

  // ── Submit ───────────────────────────────────────────────────────────────
  async function submit() {
    if (!reviewerName || !current) return;
    setStatus(null);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewerName, groupKey: current.groupKey, answers }),
    });
    setStatus(res.ok ? "已儲存" : "儲存失敗");
  }

  function logout() {
    localStorage.removeItem(REVIEWER_KEY);
    sessionStorage.removeItem(INDEX_KEY);
    router.replace("/login");
  }

  function downloadCsv() {
    const params = new URLSearchParams({ format: "csv" });
    if (reviewerName) params.set("reviewerName", reviewerName);
    window.open(`/api/reviews/export?${params}`, "_blank");
  }

  if (!reviewerName) return null;
  if (loadErr)
    return <div className="p-8 text-center text-red-400">{loadErr}</div>;
  if (!survey)
    return (
      <div className="p-8 text-center text-[var(--muted)]">載入問卷…</div>
    );

  const closePreview = () => setPreview(null);
  const total = groups.length;
  const n = total === 0 ? 0 : Math.min(index + 1, total);

  // A圖 = raw, B圖 = 最新版本 (v3 > v2 > v1)
  const slotA = current?.slots.raw ?? null;
  const slotB = current ? getLatestVersionSlot(current.slots) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* ── Header ── */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <p className="text-sm text-[var(--muted)]">
            審查者：<span className="text-[var(--text)]">{reviewerName}</span>
          </p>
          <p className="mt-1 text-lg font-semibold">
            目前第 {n} 筆 / 共 {total} 筆
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={index <= 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-40"
          >
            上一組
          </button>
          <button
            type="button"
            disabled={index >= total - 1}
            onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-40"
          >
            下一組
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
          >
            下載 CSV
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg px-4 py-2 text-sm text-[var(--muted)] hover:text-[var(--text)]"
          >
            登出
          </button>
        </div>
      </header>

      {!current ? (
        <p className="text-[var(--muted)]">output 目錄中沒有可分組的檔案。</p>
      ) : (
        <>
          <p className="mb-4 font-mono text-sm text-[var(--muted)]">
            {current.groupKey}
          </p>

          {/* ── A/B 圖片 + 問卷並排 ── */}
          <div className="mb-6 grid grid-cols-2 gap-6">
            {/* ── A圖欄 ── */}
            <div className="flex flex-col gap-4">
              <SlotImage
                rel={slotA}
                label="A圖（原始圖）"
                badge="A"
                onOpenPreview={(src, title) => setPreview({ src, title })}
              />
              <CollapsibleSurveyPanel
                key={`${current.groupKey}_A`}
                title="A圖審查問卷"
                suffix="_A"
                questions={nonCompareQuestions}
                answers={answers}
                onSetAnswer={dispatchSetAnswer}
              />
              <ImageAnnotator
                src={assetUrl(slotA)}
                label="A圖（原始圖）"
                groupKey={current.groupKey}
                imageKey="A"
              />
            </div>

            {/* ── B圖欄 ── */}
            <div className="flex flex-col gap-4">
              <SlotImage
                rel={slotB}
                label="B圖（最後一版圖）"
                badge="B"
                onOpenPreview={(src, title) => setPreview({ src, title })}
              />
              <CollapsibleSurveyPanel
                key={`${current.groupKey}_B`}
                title="B圖審查問卷"
                suffix="_B"
                questions={nonCompareQuestions}
                answers={answers}
                onSetAnswer={dispatchSetAnswer}
              />
              <ImageAnnotator
                src={assetUrl(slotB)}
                label="B圖（最後一版圖）"
                groupKey={current.groupKey}
                imageKey="B"
              />
            </div>
          </div>

          <ImageLightbox
            open={preview !== null}
            src={preview?.src ?? null}
            title={preview?.title ?? ""}
            onClose={closePreview}
          />

          {/* ── 比較問題 + 送出 ── */}
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">比較問題</h2>
              {/* Undo / Redo */}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!canUndo}
                  onClick={handleUndo}
                  title={
                    cmdHistory.current.undoDescription
                      ? `復原：${cmdHistory.current.undoDescription}`
                      : "無可復原的操作"
                  }
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-30"
                >
                  ↩ 復原
                </button>
                <button
                  type="button"
                  disabled={!canRedo}
                  onClick={handleRedo}
                  title={
                    cmdHistory.current.redoDescription
                      ? `重做：${cmdHistory.current.redoDescription}`
                      : "無可重做的操作"
                  }
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-30"
                >
                  ↪ 重做
                </button>
              </div>
            </div>

            {compareQuestion && (
              <div className="mb-6">
                <label className="mb-3 block text-sm font-medium">
                  {compareQuestion.label}
                </label>
                <div className="flex flex-wrap gap-4">
                  {COMPARE_OPTIONS.map((opt: CompareOption) => (
                    <label
                      key={opt}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${
                        answers[compareQuestion.id] === opt
                          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                          : "border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={compareQuestion.id}
                        className="sr-only"
                        checked={answers[compareQuestion.id] === opt}
                        onChange={() =>
                          dispatchSetAnswer(compareQuestion.id, opt)
                        }
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={submit}
                className="rounded-lg bg-[var(--accent)] px-6 py-2.5 font-medium text-white hover:bg-[var(--accent-dim)]"
              >
                送出
              </button>
              {status && (
                <span className="text-sm text-[var(--muted)]">{status}</span>
              )}
            </div>
          </section>

          {/* ── 底部導覽列 ── */}
          <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              disabled={index <= 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-40"
            >
              上一組
            </button>
            <button
              type="button"
              disabled={index >= total - 1}
              onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-40"
            >
              下一組
            </button>
            <button
              type="button"
              onClick={downloadCsv}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
            >
              下載 CSV
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg px-4 py-2 text-sm text-[var(--muted)] hover:text-[var(--text)]"
            >
              登出
            </button>
          </div>
        </>
      )}
    </div>
  );
}
