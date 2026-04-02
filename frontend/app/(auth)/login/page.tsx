import { LoginPage } from "@/features/auth/login-page";

export default async function LoginRoute({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return <LoginPage nextPath={next} />;
}
