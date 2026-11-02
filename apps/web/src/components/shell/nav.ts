import { GraduationCap, LampDesk, ListTodo, Network, Plug, Settings, Users, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; mobile: boolean };

export const NAV_ITEMS: NavItem[] = [
  { href: "/office", label: "Office", icon: LampDesk, mobile: true },
  { href: "/employees", label: "Employees", icon: Users, mobile: true },
  { href: "/tasks", label: "Tasks", icon: ListTodo, mobile: true },
  { href: "/organization", label: "Organization", icon: Network, mobile: false },
  { href: "/learning", label: "Learning", icon: GraduationCap, mobile: true },
  { href: "/integrations", label: "Integrations", icon: Plug, mobile: false },
  { href: "/settings", label: "Settings", icon: Settings, mobile: false },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
