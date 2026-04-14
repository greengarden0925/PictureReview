"use client";

import { useEffect, useState, useCallback } from "react";
import type { AssignmentData } from "@/lib/types";
import type { CoverageResult } from "@/lib/bibd";

// ─── 覆蓋率色彩 ───────────────────────────────────────────────────────────────
function coverageColor(count: number): string {
  if (count === 0) return "bg-red-700";
  if (count <= 2) return "bg-orange-500";
  if (count <= 5) return "bg-green-500";
  return "bg-yellow-400";
}
function coverageTextColor(count: number): string {
  if (count === 0) return "text-red-400";
  if (count <= 2) return "text-orange-400";
  if (count <= 5) return "text-green-400";
  return "text-yellow-400";
}

// ─── 小型條狀圖：每組被分配次數 ─────────────────────────────────────────────
function CoverageBarChart({
  perGroup,
  allGroups,
}: {
  perGroup: Record<string, number>;
  allGroups: string[];
}) {
  const maxCount = Math.max(...allGroups.map((g) => perGroup[g] ?? 0), 1);
  return (
    <div className="space-y-1">
      <div
        className="flex items-end gap-px overflow-x-auto"
        style={{ height: "64px" }}
        title="每條柱子代表一個圖組，高度 = 被分配審查員數"
      >
        {allGroups.map((g) => {
          const c = perGroup[g] ?? 0;
          const pct = (c / maxCount) * 100;
          return (
            <div
              key={g}
              className={`flex-shrink-0 rounded-t transition-all ${coverageColor(c)}`}
              style={{ width: "6px", height: `${pct}%` }}
              title={`${g}：${c} 次`}
            />
          );
        })}
      </div>
      {/* X 軸說明 */}
      <p className="text-[10px] text-[var(--muted)]">
        每條 = 一個圖組（共 {allGroups.length} 組）；高度 = 被分配次數
      </p>
    </div>
  );
}

// ─── 分佈長條圖：幾次 → 幾個圖組 ───────────────────────────────────────────
function DistributionChart({
  distribution,
  total,
}: {
  distribution: Record<number, number>;
  total: number;
}) {
  const entries = Object.entries(distribution)
    .map(([k, v]) => ({ count: Number(k), groups: v }))
    .sort((a, b) => a.count - b.count);
  const maxGroups = Math.max(...entries.map((e) => e.groups), 1);

  return (
    <div className="space-y-2">
      {entries.map(({ count, groups }) => (
        <div key={count} className="flex items-center gap-3">
          <span className={`w-16 text-right text-xs font-mono ${coverageTextColor(count)}`}>
            {count} 次
          </span>
          <div className="flex flex-1 items-center gap-2">
            <div
              className={`h-5 rounded ${coverageColor(count)}`}
              style={{ width: `${(groups / maxGroups) * 100}%` }}
            />
            <span className="text-xs text-[var(--muted)]">
              {groups} 組（{((groups / total) * 100).toFixed(1)}%）
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 主頁 ─────────────────────────────────────────────────────────────────────
export default function AdminAssignmentPage() {
  // ── 參數設定 ──
  const [nInput, setNInput] = useState("10");
  const [mInput, setMInput] = useState("30");
  const [token, setToken] = useState("");

  // ── 載入狀態 ──
  const [assignment, setAssignment] = useState<AssignmentData | null>(null);
  const [coverage, setCoverage] = useState<CoverageResult | null>(null);
  const [allGroups, setAllGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // ── 展開的審查員行 ──
  const [expandedReviewers, setExpandedReviewers] = useState<Set<string>>(new Set());

  // ── 載入現有分配 ──
  const loadAssignment = useCallback(async () => {
    setLoading(true);
    try {
      const [assignRes, groupsRes] = await Promise.all([
        fetch("/api/assignment").then((r) => r.json()),
        fetch("/api/groups").then((r) => r.json()),
      ]);
      setAssignment(assignRes.assignment ?? null);
      setCoverage(assignRes.coverage ?? null);
      setAllGroups((groupsRes.groups ?? []).map((g: { groupKey: string }) => g.groupKey));
      if (assignRes.assignment) {
        setNInput(String(assignRes.assignment.n));
        setMInput(String(assignRes.assignment.m));
      }
    } catch {
      setErr("載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssignment();
  }, [loadAssignment]);

  // ── 預覽計算 ──
  const v = allGroups.length;
  const nVal = parseInt(nInput, 10);
  const mVal = parseInt(mInput, 10);
  const validN = Number.isInteger(nVal) && nVal > 0;
  const validM = Number.isInteger(mVal) && mVal > 0 && mVal <= v;
  const r = validN && validM && v > 0 ? (nVal * mVal) / v : null;
  const rOk = r !== null && r >= 3 && r <= 5;

  // ── 生成分配 ──
  async function generate() {
    setMsg(null);
    setErr(null);
    setGenerating(true);
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token.trim()) headers.Authorization = `Bearer ${token.trim()}`;

      const res = await fetch("/api/assignment", {
        method: "POST",
        headers,
        body: JSON.stringify({ n: nVal, m: mVal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "生成失敗");
      } else {
        setAssignment(data.assignment);
        setCoverage(data.coverage);
        setMsg("分配已生成並儲存");
        setExpandedReviewers(new Set());
      }
    } catch {
      setErr("網路錯誤");
    } finally {
      setGenerating(false);
    }
  }

  function toggleReviewer(name: string) {
    setExpandedReviewers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  if (loading) {
    return <div className="p-8 text-[var(--muted)]">載入中…</div>;
  }

  const reviewerEntries = assignment
    ? Object.entries(assignment.reviewerGroups).sort(([a], [b]) => a.localeCompare(b))
    : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">審查員分配設定</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">
        採用近似 BIBD（平衡不完整區塊設計）：每位審查員恰好審 m 組，每組被審查次數差距 ≤ 1。
      </p>

      {/* ── 參數設定卡片 ── */}
      <section className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="mb-4 text-lg font-semibold">參數設定</h2>

        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">審查員人數 n</span>
            <input
              type="number"
              min={1}
              value={nInput}
              onChange={(e) => setNInput(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">每人審查組數 m</span>
            <input
              type="number"
              min={1}
              max={v || undefined}
              value={mInput}
              onChange={(e) => setMInput(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Admin token（選填）</span>
            <input
              type="password"
              placeholder="未設定時可留空"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
            />
          </label>
        </div>

        {/* 預覽數值 */}
        {v > 0 && (
          <div className="mb-4 flex flex-wrap gap-4 rounded-lg border border-[var(--border)] bg-black/20 px-4 py-3 text-sm">
            <span>
              總圖組數 <strong className="text-[var(--text)]">v = {v}</strong>
            </span>
            <span>
              總分配數 <strong className="text-[var(--text)]">n×m = {validN && validM ? nVal * mVal : "—"}</strong>
            </span>
            <span>
              每組審查次數{" "}
              <strong className={r !== null ? (rOk ? "text-green-400" : "text-orange-400") : "text-[var(--text)]"}>
                r = {r !== null ? r.toFixed(2) : "—"}
              </strong>
            </span>
            {r !== null && !rOk && (
              <span className="text-orange-400 text-xs">
                ⚠ 建議 r 介於 3–5
              </span>
            )}
            {r !== null && rOk && (
              <span className="text-green-400 text-xs">✓ 符合 3–5 次審查建議</span>
            )}
          </div>
        )}

        {msg && <p className="mb-3 text-sm text-green-400">{msg}</p>}
        {err && <p className="mb-3 text-sm text-red-400">{err}</p>}

        <button
          type="button"
          onClick={generate}
          disabled={generating || !validN || !validM || v === 0}
          className="rounded-lg bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-dim)] disabled:opacity-40"
        >
          {generating ? "生成中…" : assignment ? "重新生成分配" : "生成分配"}
        </button>
        {assignment && (
          <span className="ml-3 text-xs text-[var(--muted)]">
            ⚠ 重新生成將覆蓋現有分配，進行中的審查不受影響（已儲存答案保留）
          </span>
        )}
      </section>

      {/* ── 儀表板 ── */}
      {assignment && coverage && (
        <>
          {/* 統計摘要 */}
          <section className="mb-6 grid gap-4 sm:grid-cols-4">
            {[
              { label: "審查員人數", value: assignment.n },
              { label: "每人組數", value: assignment.m },
              { label: "圖組總數", value: assignment.totalGroups },
              {
                label: "每組審查次數",
                value: `${coverage.stats.min}–${coverage.stats.max}`,
                sub: `平均 ${coverage.stats.avg.toFixed(2)}`,
              },
            ].map(({ label, value, sub }) => (
              <div
                key={label}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center"
              >
                <p className="text-2xl font-bold text-[var(--text)]">{value}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{label}</p>
                {sub && <p className="text-[10px] text-[var(--muted)]">{sub}</p>}
              </div>
            ))}
          </section>

          {/* 覆蓋率圖表區 */}
          <section className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-lg font-semibold">圖組覆蓋率分布</h2>
            <div className="grid gap-8 md:grid-cols-2">
              {/* 每組條狀圖 */}
              <div>
                <p className="mb-2 text-sm font-medium text-[var(--muted)]">各圖組審查次數（條狀圖）</p>
                <CoverageBarChart
                  perGroup={coverage.perGroup}
                  allGroups={allGroups}
                />
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  {[
                    { label: "0 次（未分配）", cls: "bg-red-700" },
                    { label: "1–2 次（不足）", cls: "bg-orange-500" },
                    { label: "3–5 次（建議範圍）", cls: "bg-green-500" },
                    { label: "> 5 次（過多）", cls: "bg-yellow-400" },
                  ].map(({ label, cls }) => (
                    <span key={label} className="flex items-center gap-1.5">
                      <span className={`inline-block h-3 w-3 rounded-sm ${cls}`} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              {/* 分佈長條圖 */}
              <div>
                <p className="mb-2 text-sm font-medium text-[var(--muted)]">審查次數分佈</p>
                <DistributionChart
                  distribution={coverage.stats.distribution}
                  total={allGroups.length}
                />
              </div>
            </div>
          </section>

          {/* 審查員分配表 */}
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">審查員分配表</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedReviewers(new Set(reviewerEntries.map(([k]) => k)))
                  }
                  className="rounded border border-[var(--border)] px-3 py-1 text-xs"
                >
                  全部展開
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedReviewers(new Set())}
                  className="rounded border border-[var(--border)] px-3 py-1 text-xs"
                >
                  全部收合
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                    <th className="py-2 pr-4 font-medium">審查員名稱</th>
                    <th className="py-2 pr-4 font-medium">組數</th>
                    <th className="py-2 font-medium">圖組（點擊展開）</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewerEntries.map(([name, groups]) => {
                    const open = expandedReviewers.has(name);
                    return (
                      <>
                        <tr
                          key={name}
                          className="cursor-pointer border-b border-[var(--border)]/50 hover:bg-white/5"
                          onClick={() => toggleReviewer(name)}
                        >
                          <td className="py-2.5 pr-4 font-mono font-semibold">
                            {name}
                          </td>
                          <td className="py-2.5 pr-4 text-[var(--muted)]">
                            {groups.length}
                          </td>
                          <td className="py-2.5 text-xs text-[var(--muted)]">
                            {open ? (
                              <span className="text-[var(--accent)]">▲ 收合</span>
                            ) : (
                              <span>{groups.slice(0, 3).join("、")}{groups.length > 3 ? `… 等 ${groups.length} 組` : ""}</span>
                            )}
                          </td>
                        </tr>
                        {open && (
                          <tr key={`${name}-detail`} className="border-b border-[var(--border)]/30">
                            <td colSpan={3} className="bg-black/20 px-4 py-3">
                              <div className="flex flex-wrap gap-1.5">
                                {groups.map((g) => (
                                  <span
                                    key={g}
                                    className="rounded bg-[var(--accent)]/10 px-2 py-0.5 font-mono text-[10px] text-[var(--accent)]"
                                  >
                                    {g}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-xs text-[var(--muted)]">
              審查員以上方名稱登入後，將只看到其分配到的圖組。
              生成時間：{assignment.generatedAt ? new Date(assignment.generatedAt).toLocaleString("zh-TW") : "—"}
            </p>
          </section>
        </>
      )}
    </div>
  );
}
