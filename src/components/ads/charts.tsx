"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCount, formatMoney } from "@/lib/advertising/format";

const SLATE = "#0f172a";
const SKY = "#0284c7";
const GRID = "#e2e8f0";

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const tooltipStyle = {
  borderRadius: 0,
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
  fontSize: 12,
};

export function SpendTrendChart({
  data,
}: {
  data: { date: string; spendCents: number }[];
}) {
  const points = data.map((d) => ({
    date: shortDate(d.date),
    spend: d.spendCents / 100,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="fill-spend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SLATE} stopOpacity={0.16} />
            <stop offset="100%" stopColor={SLATE} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="4 4" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) =>
            new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              notation: v >= 1000 ? "compact" : "standard",
              maximumFractionDigits: 0,
            }).format(v)
          }
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [
            formatMoney(Math.round(Number(value) * 100)),
            "Spend",
          ]}
        />
        <Area
          type="monotone"
          dataKey="spend"
          name="Spend"
          stroke={SLATE}
          strokeWidth={2}
          fill="url(#fill-spend)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ConversionTrendChart({
  data,
}: {
  data: { date: string; conversions: number }[];
}) {
  const points = data.map((d) => ({
    date: shortDate(d.date),
    conversions: d.conversions,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="fill-conv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SKY} stopOpacity={0.18} />
            <stop offset="100%" stopColor={SKY} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="4 4" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [formatCount(Number(value)), "Conversions"]}
        />
        <Area
          type="monotone"
          dataKey="conversions"
          name="Conversions"
          stroke={SKY}
          strokeWidth={2}
          fill="url(#fill-conv)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

const PLATFORM_LABEL: Record<string, string> = {
  GOOGLE: "Google",
  META: "Meta",
  AI_CHAT: "AI / ChatGPT",
};

export function PlatformCompareChart({
  data,
}: {
  data: { platform: string; spendCents: number; conversions: number }[];
}) {
  const points = data.map((d) => ({
    name: PLATFORM_LABEL[d.platform] ?? d.platform,
    spend: d.spendCents / 100,
    conversions: d.conversions,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="4 4" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) =>
            new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              notation: v >= 1000 ? "compact" : "standard",
              maximumFractionDigits: 0,
            }).format(v)
          }
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value, name) =>
            name === "Spend"
              ? [formatMoney(Math.round(Number(value) * 100)), "Spend"]
              : [formatCount(Number(value)), "Conversions"]
          }
        />
        <Bar dataKey="spend" name="Spend" fill={SLATE} maxBarSize={48} />
        <Bar dataKey="conversions" name="Conversions" fill={SKY} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}
