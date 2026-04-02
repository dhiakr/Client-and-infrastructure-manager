import type { ReactNode } from "react";
import Link from "next/link";
import { LockKeyhole, SearchX, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function CenteredState({
  action,
  description,
  icon,
  title,
}: {
  action?: ReactNode;
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
      <Card className="w-full max-w-lg p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          {icon}
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-3 text-sm text-slate-500">{description}</p>
        {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
      </Card>
    </div>
  );
}

export function ForbiddenState() {
  return (
    <CenteredState
      icon={<LockKeyhole className="h-6 w-6" />}
      title="Forbidden"
      description="Your role does not include access to this area. Use the navigation to return to a visible workspace."
      action={
        <Link href="/dashboard">
          <Button>Back to dashboard</Button>
        </Link>
      }
    />
  );
}

export function NotFoundState() {
  return (
    <CenteredState
      icon={<SearchX className="h-6 w-6" />}
      title="Page not found"
      description="The page or record you requested does not exist, or the link is out of date."
      action={
        <Link href="/dashboard">
          <Button>Back to dashboard</Button>
        </Link>
      }
    />
  );
}

export function ErrorState({
  description,
  onRetry,
}: {
  description: string;
  onRetry?: () => void;
}) {
  return (
    <CenteredState
      icon={<TriangleAlert className="h-6 w-6" />}
      title="Something went wrong"
      description={description}
      action={
        onRetry ? (
          <Button onClick={onRetry}>Retry</Button>
        ) : (
          <Link href="/dashboard">
            <Button>Back to dashboard</Button>
          </Link>
        )
      }
    />
  );
}
