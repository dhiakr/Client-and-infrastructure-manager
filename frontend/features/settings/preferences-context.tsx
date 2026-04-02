"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

import {
  defaultPreferences,
  normalizeLandingPage,
  type Preferences,
} from "@/lib/preferences";
import { PREFERENCES_STORAGE_KEY } from "@/lib/storage";

type PreferencesContextValue = {
  preferences: Preferences;
  updatePreferences: (nextPreferences: Partial<Preferences>) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const PREFERENCES_STORAGE_EVENT = "client-infra-manager:preferences-storage";
const SERVER_PREFERENCES_SNAPSHOT = defaultPreferences;

let cachedPreferencesRawValue: string | null | undefined;
let cachedPreferencesSnapshot: Preferences = defaultPreferences;

function readStoredPreferences() {
  if (typeof window === "undefined") return SERVER_PREFERENCES_SNAPSHOT;

  try {
    const rawValue = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (rawValue === cachedPreferencesRawValue) {
      return cachedPreferencesSnapshot;
    }

    if (!rawValue) {
      cachedPreferencesRawValue = rawValue;
      cachedPreferencesSnapshot = defaultPreferences;
      return cachedPreferencesSnapshot;
    }

    const storedPreferences = JSON.parse(rawValue) as Partial<Preferences>;
    cachedPreferencesRawValue = rawValue;
    cachedPreferencesSnapshot = {
      ...defaultPreferences,
      ...storedPreferences,
      landingPage: normalizeLandingPage(storedPreferences.landingPage),
    };
    return cachedPreferencesSnapshot;
  } catch {
    cachedPreferencesRawValue = null;
    cachedPreferencesSnapshot = defaultPreferences;
    return cachedPreferencesSnapshot;
  }
}

function subscribeToPreferences(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleChange = (event: Event) => {
    if (event.type === "storage") {
      const storageEvent = event as StorageEvent;
      if (storageEvent.key && storageEvent.key !== PREFERENCES_STORAGE_KEY) return;
    }

    onStoreChange();
  };

  window.addEventListener("storage", handleChange);
  window.addEventListener(PREFERENCES_STORAGE_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(PREFERENCES_STORAGE_EVENT, handleChange);
  };
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const preferences = useSyncExternalStore(
    subscribeToPreferences,
    readStoredPreferences,
    () => SERVER_PREFERENCES_SNAPSHOT,
  );

  function updatePreferences(nextPreferences: Partial<Preferences>) {
    const mergedPreferences = {
      ...preferences,
      ...nextPreferences,
      landingPage: normalizeLandingPage(nextPreferences.landingPage ?? preferences.landingPage),
    };

    const serializedPreferences = JSON.stringify(mergedPreferences);
    cachedPreferencesRawValue = serializedPreferences;
    cachedPreferencesSnapshot = mergedPreferences;
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, serializedPreferences);
    window.dispatchEvent(new Event(PREFERENCES_STORAGE_EVENT));
  }

  const value: PreferencesContextValue = {
    preferences,
    updatePreferences,
  };

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);

  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider.");
  }

  return context;
}
