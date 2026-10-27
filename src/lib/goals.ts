import { supabase } from "./supabase";
import { friendlyError } from "./errors";

// Savings goals, stored in public.savings_goals (Row Level Security keeps each
// user's goals private).

export type SavingsGoal = {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string;
  color: string;
  icon: string;
  monthlyContribution: number;
  createdAt: string;
};

type GoalRow = {
  id: string;
  name: string;
  target_amount: number | string;
  current_amount: number | string;
  deadline: string | null;
  color: string;
  icon: string;
  monthly_contribution: number | string;
  created_at: string;
};

const COLUMNS = "id, name, target_amount, current_amount, deadline, color, icon, monthly_contribution, created_at";

function toGoal(r: GoalRow): SavingsGoal {
  return {
    id: r.id,
    name: r.name,
    target: Number(r.target_amount),
    current: Number(r.current_amount),
    deadline: r.deadline ?? "",
    color: r.color,
    icon: r.icon,
    monthlyContribution: Number(r.monthly_contribution),
    createdAt: (r.created_at ?? "").slice(0, 10),
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function fetchGoals(): Promise<SavingsGoal[]> {
  const { data, error } = await supabase
    .from("savings_goals")
    .select(COLUMNS)
    .order("created_at", { ascending: true });
  if (error) throw friendlyError(error);
  return ((data ?? []) as GoalRow[]).map(toGoal);
}

export type GoalInput = {
  name: string;
  target: number;
  current: number;
  deadline: string;
  color: string;
  icon: string;
  monthlyContribution: number;
};

function validate(g: GoalInput) {
  const name = g.name.trim();
  if (!name) throw new Error("Goal name is required.");
  if (name.length > 80) throw new Error("Goal name must be 80 characters or fewer.");
  if (!Number.isFinite(g.target) || g.target <= 0) throw new Error("Target amount must be greater than 0.");
  if (!Number.isFinite(g.current) || g.current < 0) throw new Error("Current amount must be 0 or more.");
  if (!Number.isFinite(g.monthlyContribution) || g.monthlyContribution < 0) throw new Error("Monthly contribution must be 0 or more.");
  if (g.target > 9_999_999_999) throw new Error("That amount is too large.");
  if (g.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(g.deadline)) throw new Error("Please enter a valid deadline.");
  return {
    name,
    target_amount: round2(g.target),
    current_amount: round2(Math.min(g.current, g.target)),
    deadline: g.deadline || null,
    color: g.color,
    icon: g.icon,
    monthly_contribution: round2(g.monthlyContribution),
  };
}

export async function createGoal(input: GoalInput): Promise<void> {
  const values = validate(input);
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("You need to sign in again.");
  const { error } = await supabase.from("savings_goals").insert({ ...values, user_id: data.user.id });
  if (error) throw friendlyError(error);
}

export async function updateGoal(id: string, input: GoalInput): Promise<void> {
  const values = validate(input);
  const { data, error } = await supabase.from("savings_goals").update(values).eq("id", id).select("id");
  if (error) throw friendlyError(error);
  if (!data || data.length === 0) throw new Error("You are not allowed to do this.");
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from("savings_goals").delete().eq("id", id);
  if (error) throw friendlyError(error);
}

/** Adds money to a goal. Re-reads the current value first so it cannot go stale. */
export async function addContribution(id: string, amount: number): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a positive amount.");
  const { data: row, error: readError } = await supabase
    .from("savings_goals")
    .select("current_amount, target_amount")
    .eq("id", id)
    .maybeSingle();
  if (readError) throw friendlyError(readError);
  if (!row) throw new Error("That goal could not be found.");

  const next = round2(Math.min(Number(row.target_amount), Number(row.current_amount) + amount));
  const { data, error } = await supabase
    .from("savings_goals")
    .update({ current_amount: next })
    .eq("id", id)
    .select("id");
  if (error) throw friendlyError(error);
  if (!data || data.length === 0) throw new Error("You are not allowed to do this.");
}
