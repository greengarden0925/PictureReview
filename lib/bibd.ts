/**
 * Near-BIBD (Balanced Incomplete Block Design) assignment generator.
 *
 * 符號說明：
 *   v = 圖組總數   b = n = 審查員人數   k = m = 每人審查組數
 *   r = n×m / v   = 每組平均被審查次數
 *
 * 當 v, n, m 不滿足真正 BIBD 整數條件時，採貪婪平衡分配：
 *   每位審查員依序取「目前被分配次數最少」的 m 組（隨機破平）。
 *   保證：每位審查員恰好審 m 組；每組被分配次數差距 ≤ 1（完美平衡）。
 */

import type { AssignmentData } from "./types";

// ─── 工具函式 ─────────────────────────────────────────────────────────────────

/** 線性同餘亂數 (LCG)，以當前時間為種子，產生確定但隨機的序列 */
function makePrng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(1664525, s) + 1013904223;
    return (s >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── 主要函式 ─────────────────────────────────────────────────────────────────

/**
 * 驗證參數是否合理，回傳計算後的 r 與警告/錯誤訊息。
 */
export function validateAssignmentParams(
  v: number,
  n: number,
  m: number
): { ok: boolean; r: number; warnings: string[]; errors: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Number.isInteger(n) || n <= 0) errors.push("審查員人數 n 必須為正整數");
  if (!Number.isInteger(m) || m <= 0) errors.push("每人組數 m 必須為正整數");
  if (m > v) errors.push(`每人組數 m (${m}) 不可大於總組數 (${v})`);

  const r = (n * m) / v;

  if (n * m < v) {
    errors.push(`n × m = ${n * m} 小於組數 ${v}，部分圖組將無人審查`);
  }
  if (r < 3) {
    warnings.push(
      `每組平均審查次數 r ≈ ${r.toFixed(2)} 低於建議最低值 3，請增加 n 或 m`
    );
  }
  if (r > 5) {
    warnings.push(
      `每組平均審查次數 r ≈ ${r.toFixed(2)} 高於建議最高值 5，請減少 n 或 m`
    );
  }

  return { ok: errors.length === 0, r, warnings, errors };
}

/**
 * 生成近似 BIBD 的審查員分配。
 *
 * 演算法：
 *   1. 建立 coverage 陣列記錄每組已分配次數
 *   2. 對每位審查員，將所有組按 (coverage, 隨機值) 排序，取前 m 組
 *   3. 更新 coverage，重複直到所有審查員分配完畢
 *
 * 結果保證：每位審查員恰好得到 m 組；各組分配次數差距 ≤ 1。
 */
export function generateAssignment(
  groups: string[],
  n: number,
  m: number
): AssignmentData {
  const v = groups.length;
  const { ok, errors } = validateAssignmentParams(v, n, m);
  if (!ok) throw new Error(errors.join("; "));

  const rng = makePrng(Date.now() & 0xffffffff);

  // 建立 groupKey → index 的快速查找表
  const groupIndex = new Map<string, number>(groups.map((g, i) => [g, i]));

  // coverage[i] = 圖組 i 目前已被分配給幾位審查員
  const coverage = new Array<number>(v).fill(0);

  // 先隨機洗牌以增加分配多樣性
  const shuffledGroups = shuffle(groups, rng);

  const reviewerGroups: Record<string, string[]> = {};

  for (let i = 0; i < n; i++) {
    // 給每個圖組一個隨機數用於破平，避免固定順序造成偏差
    const ranked = shuffledGroups
      .map((g) => ({ g, cov: coverage[groupIndex.get(g)!], rand: rng() }))
      .sort((a, b) => a.cov - b.cov || a.rand - b.rand);

    // 取前 m 個（coverage 最低的），恢復原始排序方便閱讀
    const chosen = ranked
      .slice(0, m)
      .map((x) => x.g)
      .sort((a, b) => groups.indexOf(a) - groups.indexOf(b));

    reviewerGroups[`reviewer${i + 1}`] = chosen;

    // 更新 coverage
    for (const g of chosen) {
      coverage[groupIndex.get(g)!]++;
    }
  }

  return {
    n,
    m,
    totalGroups: v,
    generatedAt: new Date().toISOString(),
    reviewerGroups,
  };
}

// ─── 統計函式 ─────────────────────────────────────────────────────────────────

export type CoverageResult = {
  /** groupKey → 被分配審查員數 */
  perGroup: Record<string, number>;
  stats: {
    min: number;
    max: number;
    avg: number;
    /** coverage 值 → 有幾個圖組 */
    distribution: Record<number, number>;
  };
};

export function computeCoverage(
  assignment: AssignmentData,
  allGroups: string[]
): CoverageResult {
  const perGroup: Record<string, number> = {};
  allGroups.forEach((g) => (perGroup[g] = 0));

  for (const gs of Object.values(assignment.reviewerGroups)) {
    for (const g of gs) {
      perGroup[g] = (perGroup[g] ?? 0) + 1;
    }
  }

  const counts = Object.values(perGroup);
  const min = counts.length ? Math.min(...counts) : 0;
  const max = counts.length ? Math.max(...counts) : 0;
  const avg = counts.length
    ? counts.reduce((a, b) => a + b, 0) / counts.length
    : 0;

  const distribution: Record<number, number> = {};
  for (const c of counts) {
    distribution[c] = (distribution[c] ?? 0) + 1;
  }

  return { perGroup, stats: { min, max, avg, distribution } };
}
