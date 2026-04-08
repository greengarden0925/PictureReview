"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { GroupPayload, SurveyConfig, SurveyQuestion } from "@/lib/types";

const REVIEWER_KEY = "reviewerName";
const INDEX_KEY = "pictureReviewGroupIndex";

const SLOT_LABELS = [
  { key: "raw" as const, title: "原始圖" },
  { key: "v1" as const, title: "第一版圖" },
  { key: "v2" as const, title: "第2版圖" },
  { key: "v3" as const, title: "第3版圖" },
];

function assetUrl(rel: string | null) {
  if (!rel) return null;
  return `/api/asset?path=${encodeURIComponent(rel)}`;
}

/** 將 JSON key 轉成可讀標題（底線改空白，保留原樣大小寫） */
function formatJsonKeyLabel(key: string): string {
  return key.replace(/_/g, " ");
}

/**
 * 將審查報告 JSON 以 key 為小標題、巢狀段落／清單呈現。
 */
function JsonReadable({ value, depth = 0 }: { value: unknown; depth?: number }): ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-[var(--muted)]">—</span>;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    const s =
      typeof value === "string" ? value : String(value);
    return (
      <p className="whitespace-pre-wrap break-words text-[var(--text)]">{s}</p>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-[var(--muted)]">（無項目）</span>;
    }

    const allPrimitive = value.every(
      (v) =>
        v === null ||
        v === undefined ||
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean"
    );

    if (allPrimitive) {
      return (
        <ul className="list-disc space-y-1.5 pl-4 text-[var(--text)]">
          {value.map((item, i) => (
            <li key={i} className="leading-relaxed">
              <JsonReadable value={item} depth={depth + 1} />
            </li>
          ))}
        </ul>
      );
    }

    return (
      <div className="space-y-3">
        {value.map((item, i) => (
          <div
            key={i}
            className="rounded-md border border-[var(--border)]/60 bg-black/25 p-3"
          >
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">
              第 {i + 1} 筆
            </p>
            <JsonReadable value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return <span className="text-[var(--muted)]">（空物件）</span>;
    }

    return (
      <div
        className={
          depth > 0
            ? "mt-1 space-y-4 border-l border-[var(--border)]/50 pl-3"
            : "space-y-4"
        }
      >
        {entries.map(([k, v]) => (
          <section key={k}>
            <h4 className="mb-1.5 border-b border-[var(--border)]/40 pb-1 text-sm font-semibold text-[var(--text)]">
              {formatJsonKeyLabel(k)}
            </h4>
            <div className="text-xs leading-relaxed">
              <JsonReadable value={v} depth={depth + 1} />
            </div>
          </section>
        ))}
      </div>
    );
  }

  return null;
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
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
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
  onOpenPreview,
}: {
  rel: string | null;
  label: string;
  onOpenPreview: (imageUrl: string, imageTitle: string) => void;
}) {
  const url = assetUrl(rel);
  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-2 text-center text-xs font-medium text-[var(--muted)]">
        {label}
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

function SidecarBlock({
  title,
  path,
  mode,
}: {
  title: string;
  path: string | null;
  mode: "text" | "json";
}) {
  const [text, setText] = useState<string>("");
  const [jsonValue, setJsonValue] = useState<unknown | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!path) {
      setText("");
      setJsonValue(null);
      return;
    }
    const u = assetUrl(path);
    if (!u) return;
    setLoading(true);
    fetch(u)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((raw) => {
        if (mode === "json") {
          try {
            setJsonValue(JSON.parse(raw));
            setText("");
          } catch {
            setJsonValue(null);
            setText(raw);
          }
        } else {
          setJsonValue(null);
          setText(raw);
        }
      })
      .catch(() => {
        setText("（讀取失敗）");
        setJsonValue(null);
      })
      .finally(() => setLoading(false));
  }, [path, mode]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h3 className="mb-2 text-sm font-semibold text-[var(--text)]">{title}</h3>
      {!path ? (
        <p className="text-sm text-[var(--muted)]">（無檔案）</p>
      ) : (
        <div
          className={
            mode === "json"
              ? "max-h-96 min-h-[6rem] overflow-auto rounded-md border border-[var(--border)] bg-black/30 p-3 text-[var(--muted)]"
              : "max-h-48 min-h-[6rem] overflow-auto rounded-md border border-[var(--border)] bg-black/30 p-3 text-xs leading-relaxed text-[var(--muted)]"
          }
        >
          {loading ? (
            "載入中…"
          ) : mode === "json" && jsonValue !== null ? (
            <JsonReadable value={jsonValue} />
          ) : (
            <pre className="whitespace-pre-wrap break-words font-mono text-xs text-[var(--muted)]">
              {text}
            </pre>
          )}
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
  const [preview, setPreview] = useState<{
    src: string;
    title: string;
  } | null>(null);

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

  useEffect(() => {
    if (!reviewerName) return;
    let cancelled = false;
    (async () => {
      try {
        const [gr, sv] = await Promise.all([
          fetch("/api/groups").then((r) => r.json()),
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
  }, [current, loadAnswersForGroup]);

  useEffect(() => {
    sessionStorage.setItem(INDEX_KEY, String(index));
  }, [index]);

  /** groups 筆數變化時將 index 限制在合法範圍，避免越界造成 current 為 null 等異常狀態 */
  useEffect(() => {
    setIndex((i) => {
      if (groups.length === 0) return 0;
      return Math.min(Math.max(0, i), groups.length - 1);
    });
  }, [groups.length]);

  /** 換組時關閉放大預覽，避免仍顯示上一組圖 */
  useEffect(() => {
    setPreview(null);
  }, [index]);

  function setAnswer(id: string, v: number | string) {
    setAnswers((prev) => ({ ...prev, [id]: v }));
  }

  async function submit() {
    if (!reviewerName || !current) return;
    setStatus(null);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewerName,
        groupKey: current.groupKey,
        answers,
      }),
    });
    if (res.ok) {
      setStatus("已儲存");
    } else {
      setStatus("儲存失敗");
    }
  }

  function logout() {
    localStorage.removeItem(REVIEWER_KEY);
    sessionStorage.removeItem(INDEX_KEY);
    router.replace("/login");
  }

  function downloadCsv() {
    window.open("/api/reviews/export?format=csv", "_blank");
  }

  if (!reviewerName) {
    return null;
  }

  if (loadErr) {
    return (
      <div className="p-8 text-center text-red-400">{loadErr}</div>
    );
  }

  if (!survey) {
    return (
      <div className="p-8 text-center text-[var(--muted)]">載入問卷…</div>
    );
  }

  const closePreview = () => setPreview(null);

  const total = groups.length;
  const n =
    total === 0 ? 0 : Math.min(index + 1, total);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
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

          <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {SLOT_LABELS.map(({ key, title }) => (
              <SlotImage
                key={key}
                rel={current.slots[key]}
                label={title}
                onOpenPreview={(src, imageTitle) =>
                  setPreview({ src, title: imageTitle })
                }
              />
            ))}
          </div>

          <ImageLightbox
            open={preview !== null}
            src={preview?.src ?? null}
            title={preview?.title ?? ""}
            onClose={closePreview}
          />

          <div className="mb-8 grid gap-6 md:grid-cols-2">
            <SidecarBlock
              title="圖片 prompt"
              path={current.promptRelativePath}
              mode="text"
            />
            <SidecarBlock
              title="AI圖片修改意見"
              path={current.reviewReportRelativePath}
              mode="json"
            />
          </div>

          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-lg font-semibold">問卷</h2>
            <div className="flex flex-col gap-6">
              {sortedQuestions.map((q) => (
                <div key={q.id}>
                  <label className="mb-2 block text-sm font-medium">
                    {q.label}
                  </label>
                  {q.type === "likert" ? (
                    <div className="flex flex-wrap gap-3">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <label
                          key={v}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <input
                            type="radio"
                            name={q.id}
                            checked={answers[q.id] === v}
                            onChange={() => setAnswer(q.id, v)}
                          />
                          {v}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      className="min-h-[100px] w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 text-sm text-[var(--text)]"
                      value={String(answers[q.id] ?? "")}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-4">
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
        </>
      )}
    </div>
  );
}
