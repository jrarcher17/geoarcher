/** App routes that require a signed-in user (see proxy.ts). */
export const PROTECTED_PATH_PREFIXES = [
  "/dashboard",
  "/sites",
  "/scans",
  "/scan/",
  "/visibility",
  "/ai-search",
  "/recommendations",
  "/optimize",
  "/opportunities",
  "/competitors",
  "/autopilot",
  "/seo",
  "/traffic",
  "/citations",
  "/backlinks",
  "/leads",
  "/reports",
  "/settings",
  "/ad-studio",
  "/campaigns",
  "/analytics",
  "/assistant",
  "/integrations",
  "/products",
  "/ad-intelligence",
  "/creative-studio",
  "/ads",
] as const;

export function isProtectedAppPath(pathname: string): boolean {
  if (pathname === "/dashboard") return true;
  if (pathname === "/scans" || pathname.startsWith("/scan/")) return true;
  if (pathname === "/visibility" || pathname.startsWith("/visibility/")) return true;
  if (pathname === "/ai-search" || pathname.startsWith("/ai-search/")) return true;
  if (pathname === "/recommendations") return true;
  if (pathname === "/optimize") return true;
  if (pathname === "/opportunities") return true;
  if (pathname === "/competitors") return true;
  if (pathname === "/autopilot" || pathname.startsWith("/autopilot/")) return true;
  if (pathname === "/seo" || pathname.startsWith("/seo/")) return true;
  if (pathname === "/traffic") return true;
  if (pathname === "/citations") return true;
  if (pathname === "/backlinks") return true;
  if (pathname === "/leads" || pathname.startsWith("/leads/")) return true;
  if (pathname === "/reports") return true;
  if (pathname === "/settings" || pathname.startsWith("/settings/")) return true;
  if (pathname === "/sites" || pathname.startsWith("/sites/")) return true;
  if (pathname === "/ad-studio" || pathname.startsWith("/ad-studio/")) return true;
  if (pathname === "/campaigns" || pathname.startsWith("/campaigns/")) return true;
  if (pathname === "/analytics") return true;
  if (pathname === "/assistant") return true;
  if (pathname === "/integrations") return true;
  if (pathname === "/products" || pathname.startsWith("/products/")) return true;
  if (pathname === "/ad-intelligence" || pathname.startsWith("/ad-intelligence/"))
    return true;
  if (pathname === "/creative-studio" || pathname.startsWith("/creative-studio/"))
    return true;
  if (pathname === "/ads" || pathname.startsWith("/ads/")) return true;
  return false;
}

export function loginUrlWithReturn(pathname: string, search = ""): string {
  const params = new URLSearchParams();
  const returnTo = `${pathname}${search}`;
  if (returnTo && returnTo !== "/login") {
    params.set("next", returnTo);
  }
  const q = params.toString();
  return q ? `/login?${q}` : "/login";
}
