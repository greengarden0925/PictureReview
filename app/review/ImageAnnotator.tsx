"use client";

import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type NPoint = { nx: number; ny: number }; // normalized 0–1 coords

type BrushStroke = {
  kind: "brush" | "eraser";
  color: string;
  /** normalized width: fraction of display width at stroke creation */
  nwidth: number;
  pts: NPoint[];
};
type CircleStroke = {
  kind: "circle";
  color: string;
  nwidth: number;
  nx1: number;
  ny1: number;
  nx2: number;
  ny2: number;
};
type AStroke = BrushStroke | CircleStroke;
type ToolType = "circle" | "brush" | "eraser";

// ─── Constants ────────────────────────────────────────────────────────────────
const COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#a855f7", // purple
  "#ffffff", // white
] as const;

const WIDTHS: { label: string; px: number }[] = [
  { label: "細", px: 2 },
  { label: "中", px: 4 },
  { label: "粗", px: 8 },
  { label: "超粗", px: 14 },
];

// Canvas buffer width – strokes are stored in normalized coords so this only
// affects rendering quality on screen (the exported image uses natural size).
const BUF_W = 1200;

// ─── Render helper ────────────────────────────────────────────────────────────
function renderStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: AStroke[],
  W: number,
  H: number
) {
  ctx.clearRect(0, 0, W, H);
  for (const s of strokes) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // nwidth is fraction of display width; scale to target canvas width
    ctx.lineWidth = s.nwidth * W;

    if (s.kind === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      const { pts } = s;
      if (pts.length < 1) { ctx.restore(); continue; }
      ctx.beginPath();
      ctx.moveTo(pts[0].nx * W, pts[0].ny * H);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].nx * W, pts[i].ny * H);
      ctx.stroke();
    } else if (s.kind === "brush") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = s.color;
      const { pts } = s;
      if (pts.length < 1) { ctx.restore(); continue; }
      ctx.beginPath();
      ctx.moveTo(pts[0].nx * W, pts[0].ny * H);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].nx * W, pts[i].ny * H);
      ctx.stroke();
    } else if (s.kind === "circle") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = s.color;
      const cx = ((s.nx1 + s.nx2) / 2) * W;
      const cy = ((s.ny1 + s.ny2) / 2) * H;
      const rx = (Math.abs(s.nx2 - s.nx1) / 2) * W;
      const ry = (Math.abs(s.ny2 - s.ny1) / 2) * H;
      if (rx > 0.5 && ry > 0.5) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ImageAnnotator({
  src,
  label,
  groupKey,
  imageKey,
  reviewerName,
}: {
  src: string | null;
  label: string;
  groupKey: string;
  imageKey: "A" | "B";
  reviewerName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [tool, setTool] = useState<ToolType>("circle");
  const [color, setColor] = useState<string>("#ef4444");
  const [widthPx, setWidthPx] = useState(4);
  const [strokes, setStrokes] = useState<AStroke[]>([]);
  const [preview, setPreview] = useState<AStroke | null>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 1200, h: 900 });
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  // Load natural image dimensions for high-quality export
  useEffect(() => {
    if (!src) return;
    const img = new window.Image();
    img.onload = () => setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = src;
  }, [src]);

  // Clear strokes when the group / image slot changes
  useEffect(() => {
    setStrokes([]);
    setPreview(null);
  }, [groupKey, imageKey]);

  const bufH = Math.round(BUF_W / (naturalSize.w / naturalSize.h));

  // Redraw canvas whenever strokes or preview changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderStrokes(ctx, preview ? [...strokes, preview] : strokes, BUF_W, bufH);
  }, [strokes, preview, bufH]);

  // Convert screen mouse position → normalized (0–1) coords
  function getNorm(e: React.MouseEvent): NPoint {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      nx: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      ny: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }

  // nwidth is calibrated to the actual display width at stroke creation
  function currentNwidth(): number {
    const canvas = canvasRef.current;
    const displayW = canvas?.getBoundingClientRect().width ?? 400;
    return widthPx / displayW;
  }

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    isDrawingRef.current = true;
    const npt = getNorm(e);
    const nwidth = currentNwidth();
    if (tool === "brush" || tool === "eraser") {
      setPreview({ kind: tool, color, nwidth, pts: [npt] });
    } else {
      setPreview({ kind: "circle", color, nwidth, nx1: npt.nx, ny1: npt.ny, nx2: npt.nx, ny2: npt.ny });
    }
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const npt = getNorm(e);
    setPreview((prev) => {
      if (!prev) return null;
      if (prev.kind === "brush" || prev.kind === "eraser") {
        return { ...prev, pts: [...prev.pts, npt] };
      }
      return { ...prev, nx2: npt.nx, ny2: npt.ny };
    });
  }

  function onMouseUp() {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setPreview((prev) => {
      if (prev) setStrokes((s) => [...s, prev]);
      return null;
    });
  }

  function undo() {
    setStrokes((s) => s.slice(0, -1));
  }

  function clearAll() {
    setStrokes([]);
    setPreview(null);
  }

  async function buildCompositeCanvas(): Promise<HTMLCanvasElement> {
    const { w: natW, h: natH } = naturalSize;
    const imgEl = new window.Image();
    await new Promise<void>((res) => { imgEl.onload = () => res(); imgEl.src = src!; });
    const out = document.createElement("canvas");
    out.width = natW; out.height = natH;
    const ctx = out.getContext("2d")!;
    ctx.drawImage(imgEl, 0, 0, natW, natH);
    const annoCanvas = document.createElement("canvas");
    annoCanvas.width = natW; annoCanvas.height = natH;
    renderStrokes(annoCanvas.getContext("2d")!, strokes, natW, natH);
    ctx.drawImage(annoCanvas, 0, 0);
    return out;
  }

  async function saveAnnotated() {
    if (!src || strokes.length === 0) return;
    const out = await buildCompositeCanvas();
    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${groupKey}_${imageKey}圖_標記.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  async function uploadAnnotated() {
    if (!src || strokes.length === 0 || !reviewerName) return;
    setUploadStatus("uploading");
    try {
      const out = await buildCompositeCanvas();
      const imageData = out.toDataURL("image/png");
      const res = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewerName, groupKey, imageKey, imageData }),
      });
      setUploadStatus(res.ok ? "done" : "error");
    } catch {
      setUploadStatus("error");
    }
  }

  if (!src) return null;

  const cursorClass = tool === "eraser" ? "cursor-cell" : "cursor-crosshair";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      {/* ── Header ── */}
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="font-semibold">
          {imageKey === "A" ? "A圖" : "B圖"} 錯誤標記
          {strokes.length > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
              {strokes.length} 筆
            </span>
          )}
        </span>
        <span className="text-sm text-[var(--muted)]">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-[var(--border)] p-4">
          {/* ── Toolbar ── */}
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            {/* Tool buttons */}
            <div className="flex gap-1">
              {(["circle", "brush", "eraser"] as ToolType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTool(t)}
                  title={
                    t === "circle"
                      ? "圈選工具：拖曳畫橢圓"
                      : t === "brush"
                      ? "畫筆工具：自由描繪"
                      : "橡皮擦：擦除標記"
                  }
                  className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                    tool === t
                      ? "bg-[var(--accent)] text-white"
                      : "border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]/50"
                  }`}
                >
                  {t === "circle" ? "圈選" : t === "brush" ? "畫筆" : "橡皮擦"}
                </button>
              ))}
            </div>

            {/* Color swatches */}
            <div className="flex items-center gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  title={c}
                  className={`h-5 w-5 rounded-full border-2 transition-transform ${
                    color === c
                      ? "scale-125 border-white"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            {/* Line width */}
            <div className="flex gap-1">
              {WIDTHS.map(({ label, px }) => (
                <button
                  key={px}
                  type="button"
                  onClick={() => setWidthPx(px)}
                  className={`rounded px-2 py-1 text-xs transition-colors ${
                    widthPx === px
                      ? "bg-[var(--accent)] text-white"
                      : "border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]/50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-1">
              <button
                type="button"
                onClick={undo}
                disabled={strokes.length === 0}
                className="rounded border border-[var(--border)] px-3 py-1 text-xs disabled:opacity-30"
              >
                ↩ 復原
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={strokes.length === 0}
                className="rounded border border-[var(--border)] px-3 py-1 text-xs text-red-400 disabled:opacity-30"
              >
                清除全部
              </button>
              <button
                type="button"
                onClick={saveAnnotated}
                disabled={strokes.length === 0}
                className="rounded bg-[var(--accent)] px-3 py-1 text-xs font-medium text-white disabled:opacity-30"
              >
                下載標記圖片
              </button>
              {reviewerName && (
                <button
                  type="button"
                  onClick={uploadAnnotated}
                  disabled={strokes.length === 0 || uploadStatus === "uploading"}
                  className="rounded border border-[var(--border)] px-3 py-1 text-xs disabled:opacity-30"
                >
                  {uploadStatus === "uploading"
                    ? "上傳中…"
                    : uploadStatus === "done"
                    ? "✓ 已上傳"
                    : uploadStatus === "error"
                    ? "✗ 失敗"
                    : "上傳至後台"}
                </button>
              )}
            </div>
          </div>

          {/* ── Drawing area ── */}
          <div className={`relative select-none overflow-hidden rounded-lg border border-[var(--border)] ${cursorClass}`}>
            {/* Base image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={label} className="block w-full" draggable={false} />
            {/* Annotation canvas – same display size as the image above */}
            <canvas
              ref={canvasRef}
              width={BUF_W}
              height={bufH}
              className="absolute inset-0 h-full w-full"
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            />
          </div>

          <p className="mt-2 text-xs text-[var(--muted)]">
            {tool === "circle"
              ? "拖曳繪製橢圓，圈出錯誤區域"
              : tool === "brush"
              ? "按住滑鼠自由描繪"
              : "按住滑鼠擦除標記"}
            　｜　儲存後下載為 PNG（含原圖與標記）
          </p>
        </div>
      )}
    </div>
  );
}
