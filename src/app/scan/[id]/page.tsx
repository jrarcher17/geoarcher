import { ScanDashboard } from "@/components/ScanDashboard";

export default async function ScanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ScanDashboard scanId={id} />;
}
