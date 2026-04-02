import {
  Building2,
  FolderKanban,
  LayoutDashboard,
  type LucideIcon,
  ServerCog,
  Settings,
  Shield,
} from "lucide-react";

import type { UserRole } from "@/types/api";

export type NavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

const adminItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/instances", label: "Instances", icon: ServerCog },
  { href: "/assignments", label: "Assignments", icon: Shield },
  { href: "/settings", label: "Settings", icon: Settings },
];

const standardItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "My Projects", icon: FolderKanban },
  { href: "/instances", label: "Instances", icon: ServerCog },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function getNavigationForRole(role: UserRole) {
  return role === "admin" ? adminItems : standardItems;
}
