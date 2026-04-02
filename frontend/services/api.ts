import axios, { AxiosError } from "axios";
import type {
  AgentChatRequest,
  AgentChatResponse,
  BackendHealth,
  Client,
  ClientCreateInput,
  ClientUpdateInput,
  CurrentUser,
  DatabaseHealth,
  Instance,
  InstanceCreateInput,
  InstanceUpdateInput,
  LoginPayload,
  LoginResponse,
  Project,
  ProjectAssignment,
  ProjectAssignmentCreateInput,
  ProjectCreateInput,
  ProjectUpdateInput,
  ProjectWorkspace,
  UserSummary,
} from "@/types/api";

const DEFAULT_API_BASE_URL = "http://localhost:8000";
const GET_REQUEST_DEDUPE_TTL_MS = 1000;

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_BASE_URL).replace(
  /\/$/,
  "",
);

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  token?: string;
  body?: unknown;
  timeoutMs?: number;
};

type ErrorPayload = {
  detail?: string;
};

type RecentGetCacheEntry = {
  expiresAt: number;
  value: unknown;
};

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

const inFlightGetRequests = new Map<string, Promise<unknown>>();
const recentGetResponses = new Map<string, RecentGetCacheEntry>();

function buildRequestKey(path: string, options: RequestOptions) {
  return JSON.stringify({
    method: options.method ?? "GET",
    path,
    token: options.token ?? null,
  });
}

function readRecentGetResponse<T>(requestKey: string) {
  const cachedResponse = recentGetResponses.get(requestKey);
  if (!cachedResponse) return null;

  if (cachedResponse.expiresAt <= Date.now()) {
    recentGetResponses.delete(requestKey);
    return null;
  }

  return cachedResponse.value as T;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const requestKey = buildRequestKey(path, options);

  if (method === "GET") {
    const cachedResponse = readRecentGetResponse<T>(requestKey);
    if (cachedResponse !== null) {
      return cachedResponse;
    }

    const existingRequest = inFlightGetRequests.get(requestKey);
    if (existingRequest) {
      return existingRequest as Promise<T>;
    }
  } else {
    recentGetResponses.clear();
  }

  const executeRequest = async () => {
    const headers: Record<string, string> = {};

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (options.token) {
      headers.Authorization = `Bearer ${options.token}`;
    }

    try {
      const response = await axios.request({
        baseURL: API_BASE_URL,
        url: path,
        method,
        headers,
        data: options.body,
        timeout: options.timeoutMs,
        validateStatus: () => true,
      });

      const payload = response.status === 204 ? undefined : response.data;

      if (response.status < 200 || response.status >= 300) {
        const detail =
          typeof payload === "string"
            ? payload
            : typeof payload === "object" &&
                payload !== null &&
                "detail" in payload &&
                typeof (payload as ErrorPayload).detail === "string"
              ? (payload as ErrorPayload).detail!
              : `Request failed with status ${response.status}.`;

        throw new ApiError(response.status, detail);
      }

      return payload as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof AxiosError && error.code === "ECONNABORTED") {
        throw new Error("The request timed out. The backend agent did not respond in time.");
      }

      throw error;
    }
  };

  if (method !== "GET") {
    return executeRequest();
  }

  const requestPromise = executeRequest()
    .then((result) => {
      recentGetResponses.set(requestKey, {
        expiresAt: Date.now() + GET_REQUEST_DEDUPE_TTL_MS,
        value: result,
      });
      return result;
    })
    .finally(() => {
      inFlightGetRequests.delete(requestKey);
    });

  inFlightGetRequests.set(requestKey, requestPromise);
  return requestPromise;
}

export function getBackendHealth() {
  return request<BackendHealth>("/health");
}

export function getBackendDbHealth() {
  return request<DatabaseHealth>("/health/db");
}

export function login(payload: LoginPayload) {
  return request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: payload,
  });
}

export function chatWithAgent(token: string, payload: AgentChatRequest) {
  return request<AgentChatResponse>("/api/agent/chat", {
    method: "POST",
    token,
    body: payload,
    timeoutMs: 30000,
  });
}

export function getCurrentUser(token: string) {
  return request<CurrentUser>("/api/auth/me", {
    token,
  });
}

export function getUsers(token: string, options: { query?: string; limit?: number } = {}) {
  const searchParams = new URLSearchParams();

  if (options.query?.trim()) {
    searchParams.set("query", options.query.trim());
  }

  if (options.limit) {
    searchParams.set("limit", String(options.limit));
  }

  const suffix = searchParams.size ? `?${searchParams.toString()}` : "";

  return request<UserSummary[]>(`/api/users${suffix}`, {
    token,
  });
}

export function getClients(token: string) {
  return request<Client[]>("/api/clients", {
    token,
  });
}

export function getClient(token: string, clientId: number) {
  return request<Client>(`/api/clients/${clientId}`, {
    token,
  });
}

export function createClient(token: string, payload: ClientCreateInput) {
  return request<Client>("/api/clients", {
    method: "POST",
    token,
    body: payload,
  });
}

export function updateClient(token: string, clientId: number, payload: ClientUpdateInput) {
  return request<Client>(`/api/clients/${clientId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}

export function deleteClient(token: string, clientId: number) {
  return request<void>(`/api/clients/${clientId}`, {
    method: "DELETE",
    token,
  });
}

export function getProjects(token: string) {
  return request<ProjectWorkspace[]>("/api/projects", {
    token,
  });
}

export function getProject(token: string, projectId: number) {
  return request<ProjectWorkspace>(`/api/projects/${projectId}`, {
    token,
  });
}

export function createProject(token: string, payload: ProjectCreateInput) {
  return request<Project>("/api/projects", {
    method: "POST",
    token,
    body: payload,
  });
}

export function updateProject(token: string, projectId: number, payload: ProjectUpdateInput) {
  return request<Project>(`/api/projects/${projectId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}

export function deleteProject(token: string, projectId: number) {
  return request<void>(`/api/projects/${projectId}`, {
    method: "DELETE",
    token,
  });
}

export function getProjectInstances(token: string, projectId: number) {
  return request<Instance[]>(`/api/projects/${projectId}/instances`, {
    token,
  });
}

export function getInstance(token: string, instanceId: number) {
  return request<Instance>(`/api/instances/${instanceId}`, {
    token,
  });
}

export function createProjectInstance(
  token: string,
  projectId: number,
  payload: InstanceCreateInput,
) {
  return request<Instance>(`/api/projects/${projectId}/instances`, {
    method: "POST",
    token,
    body: payload,
  });
}

export function updateProjectInstance(
  token: string,
  instanceId: number,
  payload: InstanceUpdateInput,
) {
  return request<Instance>(`/api/instances/${instanceId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}

export function deleteProjectInstance(token: string, instanceId: number) {
  return request<void>(`/api/instances/${instanceId}`, {
    method: "DELETE",
    token,
  });
}

export function getProjectAssignments(token: string, projectId: number) {
  return request<ProjectAssignment[]>(`/api/projects/${projectId}/assignments`, {
    token,
  });
}

export function createProjectAssignment(
  token: string,
  projectId: number,
  payload: ProjectAssignmentCreateInput,
) {
  return request<ProjectAssignment>(`/api/projects/${projectId}/assignments`, {
    method: "POST",
    token,
    body: payload,
  });
}

export function deleteProjectAssignment(token: string, projectId: number, userId: number) {
  return request<void>(`/api/projects/${projectId}/assignments/${userId}`, {
    method: "DELETE",
    token,
  });
}

export function isUnauthorizedError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

export function isForbiddenError(error: unknown) {
  return error instanceof ApiError && error.status === 403;
}

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.detail;
  if (error instanceof Error) return error.message;
  return "Unexpected error.";
}
