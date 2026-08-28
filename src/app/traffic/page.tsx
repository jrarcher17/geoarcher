import { AppShell } from "@/components/AppShell";
import { ConnectState } from "@/components/os/primitives";

export default function TrafficPage() {
  return (
    <AppShell
      title="Traffic"
      subtitle="See how search and AI visibility turn into visits."
    >
      <ConnectState
        title="Connect Search Console to unlock this data"
        body="GEO Archer does not invent traffic numbers. When Google Search Console is connected, this page will show clicks, impressions, and landing pages alongside AI visibility."
      />
    </AppShell>
  );
}
