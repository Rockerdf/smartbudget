import { supabase } from "./supabase";
import { friendlyError } from "./errors";

// Categories live in the database (public.categories). Built-in ones are shared
// (user_id is null); anything a user types that does not exist yet becomes a
// private category of that user.

export type CategoryRow = {
  id: string;
  user_id: string | null;
  name: string;
  type: "income" | "expense";
  color: string;
  is_system: boolean;
};

let cache: CategoryRow[] | null = null;

/** Clears the in-memory copy (call after signing out). */
export function clearCategoryCache() {
  cache = null;
}

export async function fetchCategories(force = false): Promise<CategoryRow[]> {
  if (cache && !force) return cache;
  const { data, error } = await supabase
    .from("categories")
    .select("id, user_id, name, type, color, is_system")
    .order("name", { ascending: true });
  if (error) throw friendlyError(error);
  cache = (data ?? []) as CategoryRow[];
  return cache;
}

function findByName(rows: CategoryRow[], name: string): CategoryRow | undefined {
  const wanted = name.trim().toLowerCase();
  // Prefer the user's own category over a built-in one with the same name.
  return (
    rows.find((c) => c.user_id !== null && c.name.toLowerCase() === wanted) ??
    rows.find((c) => c.name.toLowerCase() === wanted)
  );
}

/** Returns the id for a category name, creating a private category if needed. */
export async function categoryIdForName(
  name: string,
  type: "income" | "expense",
  userId: string
): Promise<string | null> {
  const clean = name.trim();
  if (!clean) return null;
  if (clean.length > 60) throw new Error("Category names must be 60 characters or fewer.");

  const rows = await fetchCategories();
  const existing = findByName(rows, clean);
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("categories")
    .insert({ user_id: userId, name: clean, type, is_system: false })
    .select("id, user_id, name, type, color, is_system")
    .single();
  if (error) throw friendlyError(error);
  cache = [...rows, data as CategoryRow];
  return (data as CategoryRow).id;
}
