// In-app notifications are worked out from the user's own budgets and savings goals.
// Which ones were read or dismissed, and which kinds the user wants, are small
// per-browser preferences kept in localStorage.
import { fetchBudget, monthStart } from "./budgets";
import type { BudgetCategory } from "./budgets";
import { fetchGoals } from "./goals";
import type { SavingsGoal } from "./goals";

export type AppNotification = {
  id: string;
  type: "warning" | "success" | "info" | "error" | "security";
  title: string;
  body: string;
  time: string;
  read: boolean;
  category: "budget" | "savings" | "report" | "security" | "system";
};

export const READ_KEY = "sb_notif_read";
export const DISMISSED_KEY = "sb_notif_dismissed";
const PREFS_KEY = "sb_notif_prefs";
export const NOTIFICATIONS_CHANGED = "sb:notifications-changed";

export type NotificationPrefs = { budgetAlerts: boolean; goalMilestones: boolean };
const DEFAULT_PREFS: NotificationPrefs = { budgetAlerts: true, goalMilestones: true };

export function loadNotificationPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_PREFS };
}

export function saveNotificationPrefs(prefs: NotificationPrefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
}

export function loadIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function saveIds(key: string, ids: string[]) {
  try { localStorage.setItem(key, JSON.stringify(ids)); } catch { /* ignore */ }
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
}

const money = (n: number) =>
  "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function buildNotifications(
  budget: BudgetCategory[],
  goals: SavingsGoal[],
  prefs: NotificationPrefs = loadNotificationPrefs(),
): AppNotification[] {
  const month = monthStart().slice(0, 7);
  const list: AppNotification[] = [];
  if (prefs.budgetAlerts) {
    for (const b of budget) {
      if (b.budgeted <= 0) continue;
      const ratio = b.spent / b.budgeted;
      if (ratio > 1) {
        list.push({ id: `budget:${b.id}:${month}:over`, type: "warning", category: "budget", read: false, time: "This month",
          title: `${b.category} over budget`,
          body: `You have spent ${money(b.spent)} against a ${money(b.budgeted)} budget, which is ${money(b.spent - b.budgeted)} over.` });
      } else if (ratio >= 0.8) {
        list.push({ id: `budget:${b.id}:${month}:near`, type: "warning", category: "budget", read: false, time: "This month",
          title: `${b.category} budget almost used`,
          body: `You have used ${Math.round(ratio * 100)}% of your ${money(b.budgeted)} budget this month.` });
      }
    }
  }
  if (prefs.goalMilestones) {
    for (const g of goals) {
      if (g.target <= 0) continue;
      if (g.current >= g.target) {
        list.push({ id: `goal:${g.id}:reached`, type: "success", category: "savings", read: false, time: "Goal reached",
          title: `${g.name} reached!`, body: `You have saved the full ${money(g.target)} for this goal.` });
      } else if (g.current / g.target >= 0.5) {
        list.push({ id: `goal:${g.id}:half`, type: "info", category: "savings", read: false, time: "Milestone",
          title: `${g.name} is over halfway`,
          body: `You have saved ${money(g.current)} of ${money(g.target)} (${Math.round((g.current / g.target) * 100)}%).` });
      }
    }
  }
  return list;
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  const [budget, goals] = await Promise.all([fetchBudget(), fetchGoals()]);
  return buildNotifications(budget, goals);
}

/** Number of notifications that are neither read nor dismissed. */
export async function countUnread(): Promise<number> {
  const list = await fetchNotifications();
  const read = loadIds(READ_KEY);
  const dismissed = loadIds(DISMISSED_KEY);
  return list.filter((n) => !read.includes(n.id) && !dismissed.includes(n.id)).length;
}
