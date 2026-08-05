"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TrendPoint {
  date: string;
  [series: string]: string | number | null;
}

const PALETTE = ["#0ea5e9", "#8b5cf6", "#10b981"];

export function TrendChart({
  data,
  series,
  height = 220,
}: {
  data: TrendPoint[];
  /** e.g. [{ key: "geo", label: "GEO Score" }] */
  series: { key: string; label: string }[];
  height?: number;
}) {
  if (data.length < 2) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50/60 text-center"
        style={{ height }}
      >
        <p className="text-sm font-medium text-slate-500">Not enough history yet</p>
        <p className="mt-1 max-w-xs text-xs text-slate-400">
          Run another scan after shipping changes to build a trend line.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.18} />
              <stop offset="100%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
            fontSize: 12,
          }}
        />
        {series.map((s, i) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth={2}
            fill={`url(#fill-${s.key})`}
            connectNulls
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
