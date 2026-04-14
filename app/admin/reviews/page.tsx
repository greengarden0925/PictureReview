"use client";

import { useEffect, useState } from "react";
import type { ReviewerSummary } from "@/app/api/reviews/summary/route";

type SummaryData = {
  summaries: ReviewerSummary[];
  totalCompleted: number;
  totalAssigned: number;
};

type AnnotationEntry = {
  reviewerName: string;
  groupKey: string;
  imageKey: string;
  uploadedAt: string;
  filename: string;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  const color =
    pct === 100
      ? "bg-green-500"
      : pct >= 50
      ? "bg-[var(--accent)]"
      : "bg-orange-400";

  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-32 overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="min-w-[3.5rem] text-right text-sm tabular-nums">
        {value} / {total}
      </span>
      <span
        className={`text-xs font-medium ${
          pct === 100
            ? "text-green-400"
            : pct >= 50
            ? "text-[var(--accent)]"
            : "text-orange-400"
        }`}
      >
        {pct}%
      </span>
    </div>
  );
}

export default function AdminReviewsPage() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [annotations, setAnnotations] = useState<AnnotationEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [summaryRes, annoRes] = await Promise.all([
        fetch("/api/reviews/summary"),
        fetch("/api/annotations"),
      ]);
      if (!summaryRes.ok) {
        const j = await summaryRes.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${summaryRes.status}`);
      }
      setData(await summaryRes.json());
      if (annoRes.ok) {
        const j = await annoRes.json();
        setAnnotations(j.annotations ?? []);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function downloadCsv(reviewerName?: string) {
    const params = new URLSearchParams({ format: "csv" });
    if (reviewerName) params.set("reviewerName", reviewerName);
    window.open(`/api/reviews/export?${params}`, "_blank");
  }

  function downloadAnnotationsZip(reviewerName?: string) {
    const params = new URLSearchParams();
    if (reviewerName) params.set("reviewer", reviewerName);
    window.open(`/api/annotations/zip?${params}`, "_blank");
  }

  const overallPct =
    data && data.totalAssigned > 0
      ? Math.round((data.totalCompleted / data.totalAssigned) * 100)
      : 0;

  // Group annotations by reviewer
  const annoByReviewer = annotations.reduce<Record<string, AnnotationEntry[]>>(
    (acc, a) => {
      (acc[a.reviewerName] ??= []).push(a);
      return acc;
    },
    {}
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">審查進度管理</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            查看每位審查員的完成狀況並下載結果
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface)]"
          >
            重新整理
          </button>
          <button
            type="button"
            onClick={() => downloadCsv()}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-dim)]"
          >
            下載全部 CSV
          </button>
        </div>
      </div>

      {/* 整體統計 */}
      {data && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
            <p className="text-2xl font-bold">{data.summaries.length}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">審查員人數</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
            <p className="text-2xl font-bold">
              {data.totalCompleted}
              <span className="text-base font-normal text-[var(--muted)]">
                {" "}
                / {data.totalAssigned}
              </span>
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">已完成 / 總分配</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
            <p
              className={`text-2xl font-bold ${
                overallPct === 100
                  ? "text-green-400"
                  : overallPct >= 50
                  ? "text-[var(--accent)]"
                  : "text-orange-400"
              }`}
            >
              {overallPct}%
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">整體完成率</p>
          </div>
        </div>
      )}

      {/* 審查員列表 */}
      <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <h2 className="font-semibold">審查員明細</h2>
        </div>

        {loading && (
          <p className="p-6 text-center text-sm text-[var(--muted)]">載入中…</p>
        )}
        {err && (
          <p className="p-6 text-center text-sm text-red-400">{err}</p>
        )}

        {data && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                <th className="px-4 py-2 font-medium">審查員</th>
                <th className="px-4 py-2 font-medium">完成進度</th>
                <th className="px-4 py-2 font-medium">最後提交</th>
                <th className="px-4 py-2 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.summaries.map((r, i) => (
                <tr
                  key={r.name}
                  className={`border-b border-[var(--border)] last:border-0 ${
                    i % 2 === 0 ? "" : "bg-black/10"
                  }`}
                >
                  <td className="px-4 py-3 font-medium">
                    {r.name}
                    {annoByReviewer[r.name]?.length > 0 && (
                      <span className="ml-2 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                        {annoByReviewer[r.name].length} 標記
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ProgressBar value={r.completed} total={r.totalAssigned} />
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {formatDate(r.lastUpdatedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => downloadCsv(r.name)}
                        disabled={r.completed === 0}
                        className="rounded border border-[var(--border)] px-3 py-1 text-xs hover:bg-[var(--border)] disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        下載 CSV
                      </button>
                      {annoByReviewer[r.name]?.length > 0 && (
                        <button
                          type="button"
                          onClick={() => downloadAnnotationsZip(r.name)}
                          className="rounded border border-[var(--border)] px-3 py-1 text-xs hover:bg-[var(--border)]"
                        >
                          標記 ZIP
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 標記圖片 */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-4 py-3 flex items-center justify-between">
          <h2 className="font-semibold">
            標記圖片
            {annotations.length > 0 && (
              <span className="ml-2 text-sm font-normal text-[var(--muted)]">
                （共 {annotations.length} 張）
              </span>
            )}
          </h2>
          {annotations.length > 0 && (
            <button
              type="button"
              onClick={() => downloadAnnotationsZip()}
              className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--accent-dim)]"
            >
              下載全部標記 ZIP
            </button>
          )}
        </div>

        {!loading && annotations.length === 0 && (
          <p className="p-6 text-center text-sm text-[var(--muted)]">
            尚無審查員上傳標記圖片
          </p>
        )}

        {annotations.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                <th className="px-4 py-2 font-medium">審查員</th>
                <th className="px-4 py-2 font-medium">圖組</th>
                <th className="px-4 py-2 font-medium">圖片</th>
                <th className="px-4 py-2 font-medium">上傳時間</th>
              </tr>
            </thead>
            <tbody>
              {annotations.map((a, i) => (
                <tr
                  key={a.filename}
                  className={`border-b border-[var(--border)] last:border-0 ${
                    i % 2 === 0 ? "" : "bg-black/10"
                  }`}
                >
                  <td className="px-4 py-3 font-medium">{a.reviewerName}</td>
                  <td className="px-4 py-3 text-[var(--muted)] text-xs">
                    {a.groupKey}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-[var(--accent)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--accent)]">
                      {a.imageKey} 圖
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {formatDate(a.uploadedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
