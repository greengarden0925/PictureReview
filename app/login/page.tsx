"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STORAGE_KEY = "reviewerName";

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    localStorage.setItem(STORAGE_KEY, trimmed);
    router.push("/review");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-xl">
        <h1 className="mb-6 text-center text-xl font-bold tracking-tight">
          PictureReview
        </h1>
        <p className="mb-6 text-center text-sm text-[var(--muted)]">
          請輸入審查者姓名以開始
        </p>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <input
            type="text"
            autoComplete="name"
            placeholder="姓名"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-[var(--text)] outline-none ring-0 placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            className="rounded-lg bg-[var(--accent)] py-3 font-medium text-white transition hover:bg-[var(--accent-dim)]"
          >
            進入審查
          </button>
        </form>
      </div>
    </div>
  );
}
