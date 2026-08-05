const STORAGE_KEY = "geoarcher.pendingAnalyzeUrl";

export function setPendingAnalyzeUrl(url: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, url.trim());
}

export function getPendingAnalyzeUrl(): string | null {
  if (typeof window === "undefined") return null;
  const v = sessionStorage.getItem(STORAGE_KEY);
  return v?.trim() ? v : null;
}

export function clearPendingAnalyzeUrl(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}

export type ScanRequestResult =
  | { ok: true; scanId: string }
  | { ok: false; error: string; status: number };

export async function requestScan(url: string): Promise<ScanRequestResult> {
  const res = await fetch("/api/scans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: url.trim() }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    scanId?: string;
    error?: string;
  };
  if (!res.ok) {
    return {
      ok: false,
      error: data.error ?? "Could not start scan.",
      status: res.status,
    };
  }
  if (!data.scanId) {
    return { ok: false, error: "Invalid response from server.", status: 500 };
  }
  return { ok: true, scanId: data.scanId };
}

/** After sign-in: run pending homepage analyze if present. */
export async function resumePendingAnalyze(): Promise<
  | { kind: "scan"; scanId: string }
  | { kind: "error"; error: string; status: number }
  | { kind: "none" }
> {
  const pending = getPendingAnalyzeUrl();
  if (!pending) return { kind: "none" };
  clearPendingAnalyzeUrl();
  const result = await requestScan(pending);
  if (result.ok) return { kind: "scan", scanId: result.scanId };
  return { kind: "error", error: result.error, status: result.status };
}
