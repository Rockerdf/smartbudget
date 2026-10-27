// Staff-only data for the admin panel. Every function here calls a checked
// database function (see supabase/admin_upgrade.sql); the database refuses
// anyone without the right role, so the screens cannot show anything extra.
import { supabase } from "./supabase";

export type DayPoint = { day: string; signups: number; logins: number };

export type ActivityItem = {
  at: string;
  kind: "admin" | "auth";
  action: string;
  who: string | null;
  target: string | null;
  details: Record<string, unknown>;
};

export type DashboardStats = {
  generated_at: string;
  users_total: number;
  users_active: number;
  users_suspended: number;
  users_by_role: Partial<Record<"user" | "support" | "admin" | "superadmin", number>>;
  new_users_7d: number;
  new_users_prev_7d: number;
  new_users_30d: number;
  active_users_7d: number;
  active_users_30d: number;
  transactions_total: number;
  transactions_30d: number;
  goals_total: number;
  goals_completed: number;
  budgets_this_month: number;
  lessons_started: number;
  lessons_completed: number;
  logins_24h: number;
  failed_logins_24h: number;
  feature_adoption: { transactions: number; budgets: number; goals: number; lessons: number };
  signups_by_day: DayPoint[];
  recent_activity: ActivityItem[];
};

export type ReportData = {
  generated_at: string;
  months: number;
  user_activity: { month: string; signups: number; active_users: number; logins: number; users_with_transactions: number }[];
  financial_trends: { month: string; transactions: number; income_total: number; expense_total: number; active_trackers: number }[];
  spending_by_category: { category: string; total: number; people: number; transactions: number }[];
  education: { lesson_id: number; started: number; completed: number }[];
  security: { month: string; logins: number; failed_logins: number; password_resets: number; admin_actions: number }[];
};

export type SecurityOverview = {
  generated_at: string;
  failed_24h: number;
  failed_7d: number;
  success_24h: number;
  resets_7d: number;
  suspended_accounts: number;
  staff_accounts: number;
  repeated_failures: { email: string; attempts: number; last_at: string; last_ip: string | null; ips: number }[];
  blocked_suspended: { email: string; at: string; ip: string | null }[];
  privilege_changes: { id: number; at: string; by: string | null; target: string | null; details: { from?: string; to?: string } }[];
  resolved_keys: string[];
  recent_failed: { email: string; at: string; ip: string | null; agent: string | null; known_user: boolean }[];
  recent_logins: { email: string; at: string; ip: string | null; agent: string | null }[];
};

export type ActivityRow = {
  kind: "admin" | "auth";
  created_at: string;
  action: string;
  who: string | null;
  who_role: string | null;
  target: string | null;
  details: Record<string, unknown>;
  ip: string | null;
  agent: string | null;
};

function fail(error: { message: string; code?: string }, what: string): never {
  console.error(`[admin] ${what}:`, error.message);
  if (error.code === "42501") throw new Error("Your role does not have access to this.");
  if (error.code === "PGRST202" || /function .* does not exist/i.test(error.message)) {
    throw new Error("The admin database functions are missing. Run supabase/admin_upgrade.sql in the Supabase SQL Editor.");
  }
  throw new Error(`Could not load ${what}. Please try again.`);
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc("admin_dashboard_stats");
  if (error) fail(error, "dashboard statistics");
  return data as DashboardStats;
}

export async function fetchReports(months = 6): Promise<ReportData> {
  const { data, error } = await supabase.rpc("admin_reports", { p_months: months });
  if (error) fail(error, "reports");
  const r = data as ReportData;
  // numeric columns arrive as strings from PostgreSQL
  r.financial_trends = r.financial_trends.map((f) => ({ ...f, income_total: num(f.income_total), expense_total: num(f.expense_total) }));
  r.spending_by_category = r.spending_by_category.map((c) => ({ ...c, total: num(c.total) }));
  return r;
}

export async function fetchSecurityOverview(): Promise<SecurityOverview> {
  const { data, error } = await supabase.rpc("admin_security_overview");
  if (error) fail(error, "security data");
  return data as SecurityOverview;
}

export async function fetchActivityLog(opts: {
  kind?: "all" | "admin" | "auth" | "security"; search?: string; limit?: number; offset?: number; since?: string | null;
} = {}): Promise<{ total: number; rows: ActivityRow[] }> {
  const { data, error } = await supabase.rpc("admin_activity_log", {
    p_kind: opts.kind ?? "all",
    p_search: opts.search || null,
    p_limit: opts.limit ?? 50,
    p_offset: opts.offset ?? 0,
    p_since: opts.since ?? null,
  });
  if (error) fail(error, "the activity log");
  const d = data as { total: number; rows: ActivityRow[] };
  return { total: num(d.total), rows: d.rows ?? [] };
}

export async function fetchLessonStats(): Promise<Record<string, { started: number; completed: number }>> {
  const { data, error } = await supabase.rpc("admin_lesson_stats");
  if (error) fail(error, "lesson statistics");
  return (data ?? {}) as Record<string, { started: number; completed: number }>;
}

export type AdminLogAction = "password_reset_sent" | "report_exported" | "users_exported" | "alert_resolved" | "audit_exported";

/** Records a staff action that happens outside the database. Never throws. */
export async function logAdminAction(action: AdminLogAction, target?: string, details: Record<string, unknown> = {}): Promise<void> {
  try {
    await supabase.rpc("log_admin_action", { p_action: action, p_target_label: target ?? null, p_details: details });
  } catch {
    /* logging must not break the action itself */
  }
}

export async function setContentVisibility(key: string, hidden: boolean, featured: boolean, label?: string): Promise<void> {
  const { error } = await supabase.rpc("admin_set_content", { p_key: key, p_hidden: hidden, p_featured: featured, p_label: label ?? null });
  if (error) fail(error, "the content change");
}

/** Plain-English label for each recorded action. */
export const ACTION_LABELS: Record<string, string> = {
  login_success: "Signed in",
  login_failed: "Failed sign-in",
  signup: "Created an account",
  password_reset_requested: "Requested a password reset",
  logout: "Signed out",
  suspended_login_blocked: "Suspended account tried to sign in",
  role_changed: "Changed a role",
  user_suspended: "Suspended a user",
  user_reactivated: "Reactivated a user",
  account_deleted: "Deleted their account",
  settings_changed: "Changed site settings",
  content_updated: "Updated content visibility",
  password_reset_sent: "Sent a password reset",
  report_exported: "Exported a report",
  users_exported: "Exported the user list",
  audit_exported: "Exported the activity log",
  alert_resolved: "Resolved a security alert",
};

export function actionLabel(a: string): string {
  return ACTION_LABELS[a] ?? a.replace(/_/g, " ");
}

export function describeActivity(a: { action: string; target: string | null; details: Record<string, unknown> }): string {
  const d = a.details ?? {};
  if (a.action === "role_changed") return `${a.target ?? "user"}: ${String(d.from ?? "?")} → ${String(d.to ?? "?")}`;
  if (a.action === "settings_changed") return Object.keys(d).map((k) => k.replace(/_/g, " ")).join(", ") || "Site settings";
  if (a.action === "content_updated") return `${a.target ?? ""}${d.hidden ? " · hidden" : " · visible"}${d.featured ? " · featured" : ""}`;
  return a.target ?? "";
}

/** "5 min ago", "3 h ago", "2 days ago", or a date. */
export function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} day${Math.floor(s / 86400) === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "";
}

/** Short browser/OS description from a user-agent string. */
export function describeAgent(agent: string | null): string {
  if (!agent) return "Unknown device";
  const browser = /Edg\//.test(agent) ? "Edge" : /OPR\//.test(agent) ? "Opera" : /Chrome\//.test(agent) ? "Chrome"
    : /Firefox\//.test(agent) ? "Firefox" : /Safari\//.test(agent) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(agent) ? "iOS" : /Android/.test(agent) ? "Android" : /Windows/.test(agent) ? "Windows"
    : /Mac OS X/.test(agent) ? "macOS" : /Linux/.test(agent) ? "Linux" : "";
  return os ? `${browser} · ${os}` : browser;
}
