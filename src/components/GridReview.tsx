import { useRef } from "react";
import {
  fitHomography,
  project,
  unitCorners,
  validCorners,
} from "../core/geometry";
import type { Point } from "../core/worksheet";
const labels = ["top-left", "top-right", "bottom-right", "bottom-left"];
// @spec SCANNER-020, SCANNER-021
export function GridReview({
  url,
  width,
  height,
  corners,
  n,
  onChange,
}: {
  url: string;
  width: number;
  height: number;
  corners: Point[];
  n: number;
  onChange: (p: Point[]) => void;
}) {
  const svg = useRef<SVGSVGElement>(null),
    drag = useRef(-1);
  let lines: { a: Point; b: Point }[] = [];
  try {
    if (validCorners(corners, width, height)) {
      const h = fitHomography(unitCorners, corners);
      for (let i = 0; i <= n; i++) {
        lines.push(
          {
            a: project(h, { x: i / n, y: 0 }),
            b: project(h, { x: i / n, y: 1 }),
          },
          {
            a: project(h, { x: 0, y: i / n }),
            b: project(h, { x: 1, y: i / n }),
          },
        );
      }
    }
  } catch {}
  const change = (i: number, p: Point) =>
    onChange(
      corners.map((old, j) =>
        j === i
          ? {
              x: Math.max(0, Math.min(width - 1, p.x)),
              y: Math.max(0, Math.min(height - 1, p.y)),
            }
          : old,
      ),
    );
  return (
    <div className="review-image" style={{ aspectRatio: `${width}/${height}` }}>
      <img src={url} alt="Your photographed worksheet" draggable={false} />
      <svg
        ref={svg}
        viewBox={`0 0 ${width} ${height}`}
        onPointerMove={(e) => {
          if (drag.current < 0) return;
          const rect = svg.current!.getBoundingClientRect();
          change(drag.current, {
            x: ((e.clientX - rect.left) / rect.width) * width,
            y: ((e.clientY - rect.top) / rect.height) * height,
          });
        }}
        onPointerUp={() => (drag.current = -1)}
        onPointerCancel={() => (drag.current = -1)}
      >
        <g
          stroke="#ed642e"
          strokeWidth={Math.max(width / 900, 1)}
          opacity=".65"
        >
          {lines.map((l, i) => (
            <line key={i} x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} />
          ))}
        </g>
        {corners.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={width * 0.013}
              fill="white"
              stroke="#d64d1f"
              strokeWidth={width * 0.004}
              tabIndex={0}
              role="slider"
              aria-label={`Grid corner ${labels[i]}`}
              aria-valuetext={`${Math.round(p.x)}, ${Math.round(p.y)}`}
              onPointerDown={(e) => {
                e.preventDefault();
                drag.current = i;
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onKeyDown={(e) => {
                const delta = e.shiftKey ? 10 : 1;
                const d: Record<string, Point> = {
                  ArrowLeft: { x: -delta, y: 0 },
                  ArrowRight: { x: delta, y: 0 },
                  ArrowUp: { x: 0, y: -delta },
                  ArrowDown: { x: 0, y: delta },
                };
                if (d[e.key]) {
                  e.preventDefault();
                  change(i, { x: p.x + d[e.key].x, y: p.y + d[e.key].y });
                }
              }}
            />
            <text
              x={p.x}
              y={p.y + width * 0.006}
              textAnchor="middle"
              fontSize={width * 0.017}
              fill="#b13d18"
              pointerEvents="none"
            >
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
