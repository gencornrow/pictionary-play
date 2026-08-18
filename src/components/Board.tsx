import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type { Point, Stroke } from "@/lib/game";

const W = 1000;
const H = 640;

type BoardProps = {
  strokes: Stroke[];
  interactive?: boolean;
  inkColor?: string;
  inkWidth?: number;
  onStroke?: (points: Point[], color: string, width: number) => void;
  className?: string;
};

export function Board({
  strokes,
  interactive = false,
  inkColor = "#F5F7FA",
  inkWidth = 5,
  onStroke,
  className,
}: BoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState<Point[] | null>(null);
  const drawing = useRef(false);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const drawPath = (points: Point[], color: string, width: number) => {
      if (points.length === 0) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      const first = points[0]!;
      ctx.moveTo(first.x * W, first.y * H);
      if (points.length === 1) {
        ctx.lineTo(first.x * W + 0.1, first.y * H + 0.1);
      } else {
        for (const p of points.slice(1)) ctx.lineTo(p.x * W, p.y * H);
      }
      ctx.stroke();
    };

    for (const stroke of strokes) drawPath(stroke.points, stroke.color, stroke.width);
    if (live) drawPath(live, inkColor, inkWidth);
  }, [strokes, live, inkColor, inkWidth]);

  useEffect(() => {
    paint();
  }, [paint]);

  const toPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className={cn(
        "w-full rounded-xl border border-border bg-surface-2 touch-none",
        interactive ? "cursor-crosshair" : "cursor-default",
        className,
      )}
      onPointerDown={(e) => {
        if (!interactive) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drawing.current = true;
        setLive([toPoint(e)]);
      }}
      onPointerMove={(e) => {
        if (!interactive || !drawing.current) return;
        const point = toPoint(e);
        setLive((prev) => (prev ? [...prev, point] : [point]));
      }}
      onPointerUp={() => {
        if (!interactive || !drawing.current) return;
        drawing.current = false;
        const points = live;
        setLive(null);
        if (points && points.length > 0) onStroke?.(points, inkColor, inkWidth);
      }}

      onPointerCancel={() => {
        drawing.current = false;
        setLive(null);
      }}
    />
  );
}
