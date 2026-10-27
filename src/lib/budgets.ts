import { supabase } from "./supabase";
import { categoryIdForName } from "./categories";
import { friendlyError } from "./errors";

// Monthly budget lines, stored in public.budgets (one row per category per month).
// "Spent" is never stored by hand: it is added up from the user's own expense
// transactions for the month, so it always matches the Transactions screen.

export type BudgetCategory = {
  id: string;
  category: string;
  budgeted: number;
  spent: number;
  color: string;
};

/** First day of the month as YYYY-MM-DD, e.g. 2026-10-01. */
export function monthStart(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function nextMonthStart(start: string): string {
  const [y, m] = start.split("-").map(Number);
  const d = new Date(y, m, 1); // JS months are 0-based, so m is already "next"
  return monthStart(d);
}

type BudgetRow = {
  id: string;
  amount_budgeted: number | string;
  color: string | null;
  categories?: { name: string } | { name: string }[] | null;
};

function nameOf(row: { categories?: { name: string } | { name: string }[] | null }): string {
  const c = row.categories;
  return (Array.isArray(c) ? c[0]?.name : c?.name) || "Other";
}

/** Total expenses per category name for one month, from the transactions table. */
export async function fetchMonthlySpend(start = monthStart()): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("transactions")
    .select("amount, categories(name)")
    .eq("type", "expense")
    .gte("date", start)
    .lt("date", nextMonthStart(start));
  if (error) throw friendlyError(error);

  const spend: Record<string, number> = {};
  for (const row of (data ?? []) as unknown as { amount: number | string; categories?: { name: string } | { name: string }[] | null }[]) {
    const name = nameOf(row);
    spend[name] = Math.round(((spend[name] ?? 0) + Number(row.amount)) * 100) / 100;
  }
  return spend;
}

export async function fetchBudget(start = monthStart()): Promise<BudgetCategory[]> {
  const { data, error } = await supabase
    .from("budgets")
    .select("id, amount_budgeted, color, categories(name)")
    .eq("period_start", start)
    .order("created_at", { ascending: true });
  if (error) throw friendlyError(error);

  const spend = await fetchMonthlySpend(start);
  return ((data ?? []) as unknown as BudgetRow[]).map((row) => {
    const category = nameOf(row);
    return {
      id: row.id,
      category,
      budgeted: Number(row.amount_budgeted),
      spent: spend[category] ?? 0,
      color: row.color ?? "#2563EB",
    };
  });
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("You need to sign in again.");
  return data.user.id;
}

export async function saveBudgetLine(input: {
  id?: string;
  category: string;
  budgeted: number;
  color: string;
}, start = monthStart()): Promise<void> {
  const category = input.category.trim();
  if (!category) throw new Error("Category name is required.");
  if (!Number.isFinite(input.budgeted) || input.budgeted <= 0) throw new Error("Amount must be greater than 0.");
  if (input.budgeted > 9_999_999_999) throw new Error("That amount is too large.");

  const userId = await currentUserId();
  const categoryId = await categoryIdForName(category, "expense", userId);
  const values = {
    category_id: categoryId,
    amount_budgeted: Math.round(input.budgeted * 100) / 100,
    color: input.color,
  };

  const query = input.id
    ? supabase.from("budgets").update(values).eq("id", input.id)
    : supabase.from("budgets").insert({ ...values, user_id: userId, period_start: start });
  const { error } = await query;

  if (error) {
    if (error.code === "23505") throw new Error("You already have a budget for that category this month.");
    throw friendlyError(error);
  }
}

export async function deleteBudgetLine(id: string): Promise<void> {
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) throw friendlyError(error);
}
