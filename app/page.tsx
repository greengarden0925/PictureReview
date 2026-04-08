"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const STORAGE_KEY = "reviewerName";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const name =
      typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_KEY)
        : null;
    router.replace(name?.trim() ? "/review" : "/login");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
      載入中…
    </div>
  );
}
