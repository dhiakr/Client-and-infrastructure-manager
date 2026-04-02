export type InterfaceDensity = "comfortable" | "compact";

export type Preferences = {
  density: InterfaceDensity;
  showRecordIds: boolean;
  landingPage: "/dashboard" | "/projects" | "/instances";
};

export const landingPages = ["/dashboard", "/projects", "/instances"] as const;

export const defaultPreferences: Preferences = {
  density: "comfortable",
  showRecordIds: true,
  landingPage: "/dashboard",
};

export function normalizeLandingPage(value: unknown): Preferences["landingPage"] {
  if (value === "/dashbaord") {
    return "/dashboard";
  }

  return landingPages.includes(value as Preferences["landingPage"])
    ? (value as Preferences["landingPage"])
    : defaultPreferences.landingPage;
}
