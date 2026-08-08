"use client";

import { hostOf } from "@/lib/utils";

export type SiteFilterOption = {
  siteId: string;
  url: string;
};

/** Filter control for Intelligence pages — All sites or one specific site. */
export function SiteFilter({
  sites,
  value,
  onChange,
  className,
}: {
  sites: SiteFilterOption[];
  value: string; // "" | siteId
  onChange: (siteId: string) => void;
  className?: string;
}) {
  if (sites.length <= 1) return null;

  const sorted = [...sites].sort((a, b) =>
    hostOf(a.url).localeCompare(hostOf(b.url))
  );

  return (
    <label
      className={
        className ??
        "inline-flex items-center gap-2 text-sm text-slate-600"
      }
    >
      <span className="shrink-0 font-medium text-slate-500">Site</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-[10rem] rounded-none border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/25"
      >
        <option value="">All sites</option>
        {sorted.map((s) => (
          <option key={s.siteId} value={s.siteId}>
            {hostOf(s.url)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function filterSitesById<T extends { siteId: string }>(
  sites: T[],
  siteId: string
): T[] {
  if (!siteId) return sites;
  return sites.filter((s) => s.siteId === siteId);
}
