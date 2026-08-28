import { AppShell } from "@/components/AppShell";
import { ConnectState } from "@/components/os/primitives";

export default function BacklinksPage() {
  return (
    <AppShell
      title="Backlinks"
      subtitle="Authority signals that help Google and AI systems trust your site."
    >
      <ConnectState
        title="A backlink index is not connected"
        body="GEO Archer will not fabricate referring domains. Connect a backlink provider later to see who links to you. Until then, crawl-based citation hints stay on each site's analysis."
      />
    </AppShell>
  );
}
