import type { UserRole } from "./auth";
import type { Screen } from "../App";

// ── Per-role access to admin screens ─────────────────────────────────────────
// Determines which screens each role may visit AND which nav items are shown.

export type AdminScreen = Extract<Screen,
  | "adminDashboard"
  | "adminUsers"
  | "adminRoles"
  | "adminReports"
  | "adminContent"
  | "adminSecurity"
  | "adminAuditLogs"
  | "adminSystemSettings"
>;

// Which roles are treated as "admin-panel" roles (go to admin shell after login)
export const ADMIN_PANEL_ROLES: UserRole[] = ["superadmin", "admin", "support"];

// Full ordered list of admin-panel screens
export const ALL_ADMIN_SCREENS: AdminScreen[] = [
  "adminDashboard",
  "adminUsers",
  "adminRoles",
  "adminReports",
  "adminContent",
  "adminSecurity",
  "adminAuditLogs",
  "adminSystemSettings",
];

// Screen → minimum roles that may access it
export const SCREEN_PERMISSIONS: Record<AdminScreen, UserRole[]> = {
  adminDashboard:     ["superadmin", "admin", "support"],
  adminUsers:         ["superadmin", "admin", "support"],
  adminRoles:         ["superadmin"],
  adminReports:       ["superadmin", "admin", "support"],
  adminContent:       ["superadmin"],
  adminSecurity:      ["superadmin", "admin"],
  adminAuditLogs:     ["superadmin", "admin"],
  adminSystemSettings:["superadmin"],
};

/** Returns true when the given role is allowed to visit the screen. */
export function canAccess(role: UserRole, screen: AdminScreen): boolean {
  return SCREEN_PERMISSIONS[screen]?.includes(role) ?? false;
}

/** Returns the subset of admin screens this role is allowed to visit. */
export function allowedScreens(role: UserRole): AdminScreen[] {
  return ALL_ADMIN_SCREENS.filter((s) => canAccess(role, s));
}

// ── Role display metadata ─────────────────────────────────────────────────────

export type RoleMeta = {
  label:     string;
  badge:     string;           // short badge text
  bg:        string;
  text:      string;
  avatarBg:  string;
  avatarFg:  string;
  ringColor: string;
};

export const ROLE_META: Record<UserRole, RoleMeta> = {
  superadmin: {
    label:    "Super Admin",
    badge:    "Super Admin",
    bg:       "#FDF2F8",
    text:     "#9D174D",
    avatarBg: "#FCE7F3",
    avatarFg: "#9D174D",
    ringColor:"#F9A8D4",
  },
  admin: {
    label:    "Admin",
    badge:    "Admin",
    bg:       "#FEF3C7",
    text:     "#92400E",
    avatarBg: "#FDE68A",
    avatarFg: "#78350F",
    ringColor:"#FCD34D",
  },
  support: {
    label:    "Support",
    badge:    "Support",
    bg:       "#FAF5FF",
    text:     "#6B21A8",
    avatarBg: "#EDE9FE",
    avatarFg: "#6B21A8",
    ringColor:"#C4B5FD",
  },
  user: {
    label:    "User",
    badge:    "User",
    bg:       "#EFF6FF",
    text:     "#1D4ED8",
    avatarBg: "#DBEAFE",
    avatarFg: "#1D4ED8",
    ringColor:"#BFDBFE",
  },
};

// ── What each role can DO on the Users page ───────────────────────────────────

export type UserPageAction =
  | "view"
  | "edit"
  | "suspend"
  | "activate"
  | "resetPassword"
  | "changeRole";

// These mirror what the database allows (see admin_set_role / admin_set_status in
// supabase/schema.sql). The database is the real gatekeeper; this list only
// decides which buttons are shown. Accounts are created by people registering
// themselves, and removed by the owner (Settings → Delete Account).
export const USER_PAGE_PERMISSIONS: Record<UserRole, UserPageAction[]> = {
  superadmin: ["view", "edit", "suspend", "activate", "resetPassword", "changeRole"],
  admin:      ["view", "edit", "suspend", "activate", "resetPassword"],
  support:    ["view", "resetPassword"],
  user:       [],
};

export function canDoUserAction(role: UserRole, action: UserPageAction): boolean {
  return USER_PAGE_PERMISSIONS[role]?.includes(action) ?? false;
}

// ── Roles that can be assigned by each role ───────────────────────────────────
// Only a superadmin can change roles (enforced in the database).

export function assignableRoles(actorRole: UserRole): UserRole[] {
  if (actorRole === "superadmin") return ["user", "support", "admin", "superadmin"];
  return [];
}
