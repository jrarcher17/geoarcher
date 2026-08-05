import { Suspense } from "react";
import { SiteWorkspace } from "@/components/site/SiteWorkspace";

export default async function SitePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  return (
    <Suspense>
      <SiteWorkspace siteId={siteId} />
    </Suspense>
  );
}
