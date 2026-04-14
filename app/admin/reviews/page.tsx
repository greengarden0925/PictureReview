"use client";

import { useEffect, useState } from "react";
import type { ReviewerSummary } from "@/app/api/reviews/summary/route";

type SummaryData = {
  summaries: ReviewerSummary[];
  totalCompleted: number;
  totalAssigned: number;
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
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/reviews/summary");
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setData(await res.json());
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

  const overallPct =
    data && data.totalAssigned > 0
      ? Math.round((data.totalCompleted / data.totalAssigned) * 100)
      : 0;

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
                {" "}/ {data.totalAssigned}
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
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <h2 className="font-semibold">審查員明細</h2>
        </div>

        {loading && (
          <p className="p-6 text-center text-sm text-[var(--muted)]">
            載入中…
          </p>
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
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3">
                    <ProgressBar value={r.completed} total={r.totalAssigned} />
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {formatDate(r.lastUpdatedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => downloadCsv(r.name)}
                      disabled={r.completed === 0}
                      className="rounded border border-[var(--border)] px-3 py-1 text-xs hover:bg-[var(--border)] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      下載 CSV
                    </button>
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
