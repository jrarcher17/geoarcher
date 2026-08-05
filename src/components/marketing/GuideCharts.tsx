"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GuideChart } from "@/lib/guides-content";

const SKY = "#0ea5e9";
const SLATE = "#94a3b8";
const VIOLET = "#8b5cf6";
const AMBER = "#f59e0b";

export function GuideChartBlock({ chart }: { chart: GuideChart }) {
  return (
    <figure className="my-10 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-6">
      <figcaption className="mb-4 text-sm font-semibold text-slate-900">
        {chart.title}
      </figcaption>
      <div className="h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          {chart.variant === "grouped" ? (
            <BarChart data={chart.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="you" name="Your site (example)" fill={SKY} radius={[4, 4, 0, 0]} />
              <Bar dataKey="rival" name="Top rival (example)" fill={SLATE} radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <BarChart
              layout={chart.horizontal ? "vertical" : "horizontal"}
              data={chart.data}
              margin={{ top: 8, right: 16, left: chart.horizontal ? 80 : 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={!chart.horizontal} />
              {chart.horizontal ? (
                <>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    width={76}
                  />
                </>
              ) : (
                <>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                </>
              )}
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="value" radius={chart.horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}>
                {chart.data.map((entry, i) => (
                  <Cell
                    key={String(entry.name)}
                    fill={
                      typeof entry.fill === "string"
                        ? entry.fill
                        : ([SKY, VIOLET, AMBER, SLATE, "#10b981"][i % 5] as string)
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">{chart.caption}</p>
    </figure>
  );
}
