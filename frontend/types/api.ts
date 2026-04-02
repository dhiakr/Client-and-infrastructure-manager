export type UserRole = "admin" | "standard";

export type InstanceType = "production" | "staging" | "development";

export type InstanceStatus = "active" | "inactive";

export type AgentActionName =
  | "search_clients"
  | "ensure_client"
  | "create_client"
  | "update_client"
  | "delete_client"
  | "search_projects"
  | "create_project"
  | "update_project"
  | "delete_project"
  | "search_instances"
  | "create_instance"
  | "update_instance"
  | "delete_instance"
  | "search_users"
  | "create_assignment"
  | "delete_assignment";

export type CurrentUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
};

export type KnownUser = CurrentUser & {
  lastSeenAt: string;
};

export type UserSummary = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: CurrentUser;
};

export type BackendHealth = {
  status: string;
  service: string;
};

export type DatabaseHealth = {
  status: string;
  database: string;
};

export type Client = {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
};

export type ClientSummary = {
  id: number;
  name: string;
};

export type ClientCreateInput = {
  name: string;
};

export type ClientUpdateInput = {
  name?: string;
};

export type Project = {
  id: number;
  client_id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectCreateInput = {
  client_id: number;
  name: string;
  description?: string | null;
};

export type ProjectUpdateInput = {
  client_id?: number;
  name?: string;
  description?: string | null;
};

export type Instance = {
  id: number;
  project_id: number;
  name: string;
  type: InstanceType;
  status: InstanceStatus;
  url: string | null;
  created_at: string;
  updated_at: string;
};

export type InstanceCreateInput = {
  name: string;
  type: InstanceType;
  status: InstanceStatus;
  url?: string | null;
};

export type InstanceUpdateInput = {
  name?: string;
  type?: InstanceType;
  status?: InstanceStatus;
  url?: string | null;
};

export type ProjectAssignment = {
  id: number;
  project_id: number;
  created_at: string;
  user: UserSummary;
};

export type ProjectAssignmentCreateInput = {
  user_id: number;
};

export type ProjectWorkspace = Project & {
  client: ClientSummary;
  instances: Instance[];
  assignments: ProjectAssignment[];
};

export type DashboardSummary = {
  clients: Client[];
  projects: Project[];
  instances: Instance[];
};

export type AgentAction = {
  action: AgentActionName;
  alias?: string | null;
  params: Record<string, unknown>;
};

export type AgentPlan = {
  summary: string;
  requires_confirmation: boolean;
  notes: string[];
  actions: AgentAction[];
};

export type AgentReference = {
  kind: "client" | "project" | "instance" | "user" | "assignment";
  id?: number | null;
  name?: string | null;
  extra: Record<string, unknown>;
};

export type AgentActionResult = {
  action: AgentActionName;
  alias?: string | null;
  status: "found" | "resolved" | "created" | "updated" | "deleted" | "assigned" | "removed";
  message: string;
  reference?: AgentReference | null;
};

export type AgentChatRequest = {
  message: string;
  mode?: "plan" | "execute";
  confirmed?: boolean;
};

export type AgentChatResponse = {
  status: "planned" | "requires_confirmation" | "executed";
  assistant_message: string;
  plan: AgentPlan;
  results: AgentActionResult[];
};
