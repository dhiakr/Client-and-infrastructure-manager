import { notFound } from "next/navigation";

import { ClientDetailPage } from "@/features/clients/client-detail-page";

export default async function ClientDetailRoute({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const parsedClientId = Number(clientId);

  if (!Number.isFinite(parsedClientId)) {
    notFound();
  }

  return <ClientDetailPage clientId={parsedClientId} />;
}
