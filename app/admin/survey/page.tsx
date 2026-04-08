"use client";

import { useEffect, useState } from "react";
import type { SurveyConfig, SurveyQuestion, QuestionType } from "@/lib/types";

function newId(): string {
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function AdminSurveyPage() {
  const [survey, setSurvey] = useState<SurveyConfig | null>(null);
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/survey")
      .then((r) => r.json())
      .then(setSurvey)
      .catch(() => setErr("載入失敗"));
  }, []);

  const qs = survey
    ? [...survey.questions].sort((a, b) => a.order - b.order)
    : [];

  function updateQuestion(id: string, patch: Partial<SurveyQuestion>) {
    if (!survey) return;
    setSurvey({
      ...survey,
      questions: survey.questions.map((q) =>
        q.id === id ? { ...q, ...patch } : q
      ),
    });
  }

  function removeQuestion(id: string) {
    if (!survey) return;
    setSurvey({
      ...survey,
      questions: survey.questions.filter((q) => q.id !== id),
    });
  }

  function move(id: string, dir: -1 | 1) {
    if (!survey) return;
    const ordered = [...qs];
    const i = ordered.findIndex((q) => q.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ordered.length) return;
    const tmp = ordered[i];
    ordered[i] = ordered[j];
    ordered[j] = tmp;
    setSurvey({
      ...survey,
      questions: ordered.map((q, idx) => ({ ...q, order: idx })),
    });
  }

  function addQuestion(type: QuestionType) {
    if (!survey) return;
    const maxOrder = Math.max(-1, ...survey.questions.map((q) => q.order));
    setSurvey({
      ...survey,
      questions: [
        ...survey.questions,
        {
          id: newId(),
          type,
          label: type === "likert" ? "新題目（Likert）" : "新題目（開放）",
          order: maxOrder + 1,
        },
      ],
    });
  }

  async function save() {
    if (!survey) return;
    setMsg(null);
    setErr(null);
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token.trim()) {
      headers.Authorization = `Bearer ${token.trim()}`;
    }
    const res = await fetch("/api/survey", {
      method: "PUT",
      headers,
      body: JSON.stringify(survey),
    });
    if (res.ok) {
      setMsg("已儲存");
    } else if (res.status === 401) {
      setErr("未授權：請設定 PICTURE_REVIEW_ADMIN_TOKEN 並輸入正確 token");
    } else {
      setErr("儲存失敗");
    }
  }

  if (!survey) {
    return (
      <div className="p-8 text-[var(--muted)]">
        {err ?? "載入中…"}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">問卷設定</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">
        若已設定環境變數 PICTURE_REVIEW_ADMIN_TOKEN，請在下方填入 token 再儲存。
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        <input
          type="password"
          placeholder="Admin token（選填）"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="flex-1 min-w-[200px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => addQuestion("likert")}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
        >
          新增 Likert
        </button>
        <button
          type="button"
          onClick={() => addQuestion("open")}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
        >
          新增開放題
        </button>
        <button
          type="button"
          onClick={save}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
        >
          儲存
        </button>
      </div>
      {msg && <p className="mb-4 text-sm text-green-400">{msg}</p>}
      {err && <p className="mb-4 text-sm text-red-400">{err}</p>}

      <ul className="flex flex-col gap-4">
        {qs.map((q) => (
          <li
            key={q.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="text-xs text-[var(--muted)]"
                onClick={() => move(q.id, -1)}
              >
                上移
              </button>
              <button
                type="button"
                className="text-xs text-[var(--muted)]"
                onClick={() => move(q.id, 1)}
              >
                下移
              </button>
              <button
                type="button"
                className="text-xs text-red-400"
                onClick={() => removeQuestion(q.id)}
              >
                刪除
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="text-sm">
                <span className="text-[var(--muted)]">id（建立後勿改，需改請刪除重建）</span>
                <p className="mt-1 font-mono text-xs text-[var(--text)]">{q.id}</p>
              </div>
              <label className="block text-sm">
                <span className="text-[var(--muted)]">題型</span>
                <select
                  className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1"
                  value={q.type}
                  onChange={(e) =>
                    updateQuestion(q.id, {
                      type: e.target.value as QuestionType,
                    })
                  }
                >
                  <option value="likert">likert（1–5）</option>
                  <option value="open">open（開放）</option>
                </select>
              </label>
            </div>
            <label className="mt-3 block text-sm">
              <span className="text-[var(--muted)]">題目文字</span>
              <input
                className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-2"
                value={q.label}
                onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
              />
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
