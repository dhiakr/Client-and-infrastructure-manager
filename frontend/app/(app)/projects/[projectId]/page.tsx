import { notFound } from "next/navigation";

import { ProjectDetailPage } from "@/features/projects/project-detail-page";

export default async function ProjectDetailRoute({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const parsedProjectId = Number(projectId);

  if (!Number.isFinite(parsedProjectId)) {
    notFound();
  }

  return <ProjectDetailPage projectId={parsedProjectId} />;
}
