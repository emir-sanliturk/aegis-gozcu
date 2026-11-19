import React, { useId, useState } from 'react';
import { TrafficPoint } from '../../types/telemetry';

export type TelemetryMetricKey = 'desktopEvents' | 'biometricChecks' | 'flaggedEvents';

interface TelemetryAreaChartProps {
  data: TrafficPoint[];
  activeSeries: Record<TelemetryMetricKey, boolean>;
  height?: number;
}

export const TelemetryAreaChart: React.FC<TelemetryAreaChartProps> = ({
  data,
  activeSeries,
  height = 235,
}) => {
  const uid = useId();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!data.length) return null;

  const width = 760;
  const padLeft = 46;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxDesktop = Math.max(...data.map((d) => d.desktopEvents), 500) * 1.15;
  const maxSecondary =
    Math.max(...data.map((d) => Math.max(d.biometricChecks, d.flaggedEvents)), 20) * 1.2;

  const getX = (i: number) =>
    padLeft + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);

  const getYDesktop = (val: number) => padTop + (1 - val / maxDesktop) * plotH;
  const getYSecondary = (val: number) => padTop + (1 - val / maxSecondary) * plotH;

  const buildSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cx = (p0.x + p1.x) / 2;
      d += ` C ${cx.toFixed(1)} ${p0.y.toFixed(1)}, ${cx.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
    return d;
  };

  const desktopPts = data.map((d, i) => ({ x: getX(i), y: getYDesktop(d.desktopEvents) }));
  const bioPts = data.map((d, i) => ({ x: getX(i), y: getYSecondary(d.biometricChecks) }));
  const flaggedPts = data.map((d, i) => ({ x: getX(i), y: getYSecondary(d.flaggedEvents) }));

  const desktopLine = buildSmoothPath(desktopPts);
  const bioLine = buildSmoothPath(bioPts);
  const flaggedLine = buildSmoothPath(flaggedPts);

  const baselineY = padTop + plotH;
  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const hoveredPoint = hoverIdx !== null ? data[hoverIdx] : null;
  const hoveredX = hoverIdx !== null ? getX(hoverIdx) : 0;

  return (
    <div className="relative w-full select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id={`emerald-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2E9B72" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#2E9B72" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`cobalt-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2878A8" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#2878A8" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`rose-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C94A4A" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#C94A4A" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((t) => {
          const y = padTop + t * plotH;
          const labelVal = Math.round(maxDesktop * (1 - t));
          return (
            <g key={t}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="#D9E2EC"
                strokeDasharray="3 4"
                strokeWidth="1"
              />
              <text
                x={padLeft - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-[#627D98] text-[10px] font-mono"
              >
                {labelVal >= 1000 ? `${(labelVal / 1000).toFixed(1)}k` : labelVal}
              </text>
            </g>
          );
        })}

        {activeSeries.desktopEvents && desktopLine && (
          <g>
            <path
              d={`${desktopLine} L ${desktopPts[desktopPts.length - 1].x.toFixed(1)} ${baselineY} L ${desktopPts[0].x.toFixed(1)} ${baselineY} Z`}
              fill={`url(#emerald-${uid})`}
            />
            <path
              d={desktopLine}
              fill="none"
              stroke="#2E9B72"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        )}

        {activeSeries.biometricChecks && bioLine && (
          <g>
            <path
              d={`${bioLine} L ${bioPts[bioPts.length - 1].x.toFixed(1)} ${baselineY} L ${bioPts[0].x.toFixed(1)} ${baselineY} Z`}
              fill={`url(#cobalt-${uid})`}
            />
            <path
              d={bioLine}
              fill="none"
              stroke="#2878A8"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </g>
        )}

        {activeSeries.flaggedEvents && flaggedLine && (
          <g>
            <path
              d={`${flaggedLine} L ${flaggedPts[flaggedPts.length - 1].x.toFixed(1)} ${baselineY} L ${flaggedPts[0].x.toFixed(1)} ${baselineY} Z`}
              fill={`url(#rose-${uid})`}
            />
            <path
              d={flaggedLine}
              fill="none"
              stroke="#C94A4A"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </g>
        )}

        {data.map((d, i) => {
          const step = data.length > 9 ? 2 : 1;
          if (i % step !== 0 && i !== data.length - 1) return null;
          return (
            <text
              key={d.timestamp}
              x={getX(i)}
              y={height - 6}
              textAnchor="middle"
              className="fill-[#627D98] text-[10px] font-mono"
            >
              {d.timestamp}
            </text>
          );
        })}

        {hoverIdx !== null && (
          <g>
            <line
              x1={hoveredX}
              y1={padTop}
              x2={hoveredX}
              y2={baselineY}
              stroke="#9FB3C8"
              strokeDasharray="2 3"
              strokeWidth="1"
            />
            {activeSeries.desktopEvents && (
              <circle
                cx={desktopPts[hoverIdx].x}
                cy={desktopPts[hoverIdx].y}
                r="4"
                fill="#FFFFFF"
                stroke="#2E9B72"
                strokeWidth="2"
              />
            )}
            {activeSeries.biometricChecks && (
              <circle
                cx={bioPts[hoverIdx].x}
                cy={bioPts[hoverIdx].y}
                r="4"
                fill="#FFFFFF"
                stroke="#2878A8"
                strokeWidth="2"
              />
            )}
            {activeSeries.flaggedEvents && (
              <circle
                cx={flaggedPts[hoverIdx].x}
                cy={flaggedPts[hoverIdx].y}
                r="4"
                fill="#FFFFFF"
                stroke="#C94A4A"
                strokeWidth="2"
              />
            )}
          </g>
        )}

        {data.map((d, i) => {
          const colW = plotW / data.length;
          const x = getX(i) - colW / 2;
          return (
            <rect
              key={`hit-${d.timestamp}`}
              x={Math.max(padLeft, x)}
              y={padTop}
              width={colW}
              height={plotH}
              fill="transparent"
              className="cursor-crosshair"
              onMouseEnter={() => setHoverIdx(i)}
            />
          );
        })}
      </svg>

      {hoveredPoint && hoverIdx !== null && (
        <div
          className="pointer-events-none absolute top-2 z-20 rounded-lg border border-[#D9E2EC] bg-white/95 px-3 py-2 text-xs shadow-md backdrop-blur-md"
          style={{
            left: `${Math.min(Math.max((hoverIdx / Math.max(data.length - 1, 1)) * 100, 14), 72)}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="mb-1.5 flex items-center justify-between gap-4 border-b border-[#D9E2EC] pb-1">
            <span className="font-mono text-[11px] font-semibold text-[#102A43]">
              {hoveredPoint.timestamp}
            </span>
            <span className="font-mono text-[11px] text-[#627D98] tabular-nums">
              {hoveredPoint.latencyMs.toFixed(1)} ms
            </span>
          </div>
          <div className="space-y-1 font-mono text-[11px] tabular-nums">
            {activeSeries.desktopEvents && (
              <div className="flex items-center justify-between gap-5">
                <span className="text-[#2E9B72]">ETW/ES Olay</span>
                <span className="text-[#102A43]">{hoveredPoint.desktopEvents.toLocaleString()}</span>
              </div>
            )}
            {activeSeries.biometricChecks && (
              <div className="flex items-center justify-between gap-5">
                <span className="text-[#2878A8]">Yüz Doğrulama</span>
                <span className="text-[#102A43]">{hoveredPoint.biometricChecks}</span>
              </div>
            )}
            {activeSeries.flaggedEvents && (
              <div className="flex items-center justify-between gap-5">
                <span className="text-[#C94A4A]">Şüpheli / Kanıt</span>
                <span className="text-[#102A43]">{hoveredPoint.flaggedEvents}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
