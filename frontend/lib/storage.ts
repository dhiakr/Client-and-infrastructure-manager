import type { CurrentUser, KnownUser } from "@/types/api";

export const TOKEN_STORAGE_KEY = "client-infra-manager.token";
export const KNOWN_USERS_STORAGE_KEY = "client-infra-manager.known-users";
export const PREFERENCES_STORAGE_KEY = "client-infra-manager.preferences";

const TOKEN_STORAGE_EVENT = "client-infra-manager:token-storage";
const KNOWN_USERS_STORAGE_EVENT = "client-infra-manager:known-users-storage";
const EMPTY_KNOWN_USERS: KnownUser[] = [];

let cachedKnownUsersRawValue: string | null | undefined;
let cachedKnownUsersSnapshot: KnownUser[] = EMPTY_KNOWN_USERS;

function dispatchStorageChange(eventName: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(eventName));
}

function subscribeToStorageKey(
  storageKey: string,
  eventName: string,
  onStoreChange: () => void,
) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleChange = (event: Event) => {
    if (event.type === "storage") {
      const storageEvent = event as StorageEvent;
      if (storageEvent.key && storageEvent.key !== storageKey) return;
    }

    onStoreChange();
  };

  window.addEventListener("storage", handleChange);
  window.addEventListener(eventName, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(eventName, handleChange);
  };
}

export function subscribeToTokenStorage(onStoreChange: () => void) {
  return subscribeToStorageKey(TOKEN_STORAGE_KEY, TOKEN_STORAGE_EVENT, onStoreChange);
}

export function subscribeToKnownUsersStorage(onStoreChange: () => void) {
  return subscribeToStorageKey(
    KNOWN_USERS_STORAGE_KEY,
    KNOWN_USERS_STORAGE_EVENT,
    onStoreChange,
  );
}

export function readToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function persistToken(token: string | null) {
  if (typeof window === "undefined") return;

  if (token) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  dispatchStorageChange(TOKEN_STORAGE_EVENT);
}

export function readKnownUsers() {
  if (typeof window === "undefined") return EMPTY_KNOWN_USERS;

  try {
    const rawValue = window.localStorage.getItem(KNOWN_USERS_STORAGE_KEY);

    if (rawValue === cachedKnownUsersRawValue) {
      return cachedKnownUsersSnapshot;
    }

    cachedKnownUsersRawValue = rawValue;
    cachedKnownUsersSnapshot = rawValue ? (JSON.parse(rawValue) as KnownUser[]) : EMPTY_KNOWN_USERS;
    return cachedKnownUsersSnapshot;
  } catch {
    cachedKnownUsersRawValue = null;
    cachedKnownUsersSnapshot = EMPTY_KNOWN_USERS;
    return cachedKnownUsersSnapshot;
  }
}

export function persistKnownUsers(users: KnownUser[]) {
  if (typeof window === "undefined") return;

  const serializedUsers = JSON.stringify(users);
  cachedKnownUsersRawValue = serializedUsers;
  cachedKnownUsersSnapshot = users;
  window.localStorage.setItem(KNOWN_USERS_STORAGE_KEY, serializedUsers);
  dispatchStorageChange(KNOWN_USERS_STORAGE_EVENT);
}

export function mergeKnownUsers(users: KnownUser[], nextUser: CurrentUser) {
  const nextUsers = users.filter((item) => item.id !== nextUser.id);

  nextUsers.push({
    ...nextUser,
    lastSeenAt: new Date().toISOString(),
  });

  return nextUsers.sort((left, right) => left.name.localeCompare(right.name));
}
