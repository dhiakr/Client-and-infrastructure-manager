import { normalizeLandingPage, type Preferences } from "@/lib/preferences";

const AUTHENTICATED_ROUTE_PREFIXES = [
  "/dashboard",
  "/projects",
  "/instances",
  "/clients",
  "/assignments",
  "/settings",
  "/forbidden",
] as const;

function normalizeTypoPath(path: string) {
  if (path === "/dashbaord") {
    return "/dashboard";
  }

  return path;
}

function isValidAuthenticatedPath(path: string) {
  const [pathname] = path.split("?");

  if (pathname === "/") {
    return true;
  }

  return AUTHENTICATED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function resolveAuthenticatedPath(
  nextPath: string | undefined,
  landingPage: Preferences["landingPage"],
) {
  const normalizedLandingPage = normalizeLandingPage(landingPage);

  if (!nextPath) {
    return normalizedLandingPage;
  }

  const trimmedPath = normalizeTypoPath(nextPath.trim());

  if (!trimmedPath.startsWith("/") || trimmedPath.startsWith("//")) {
    return normalizedLandingPage;
  }

  if (trimmedPath === "/" || trimmedPath === "/login" || trimmedPath.startsWith("/login?")) {
    return normalizedLandingPage;
  }

  return isValidAuthenticatedPath(trimmedPath) ? trimmedPath : normalizedLandingPage;
}
