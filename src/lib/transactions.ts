import { supabase } from "./supabase";
import { categoryIdForName } from "./categories";
import { friendlyError } from "./errors";
import { buildTransactionInsertFields, parseTransactionType, type TransactionType } from "./transactionPayload";

export type { TransactionType };
export { parseTransactionType };

export type Transaction = {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  type: TransactionType;
  recurring: boolean;
  note?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TransactionsChangedListener = () => void;
const transactionsChangedListeners = new Set<TransactionsChangedListener>();

export function subscribeTransactionsChanged(listener: TransactionsChangedListener) {
  transactionsChangedListeners.add(listener);
  return () => {
    transactionsChangedListeners.delete(listener);
  };
}

function notifyTransactionsChanged() {
  transactionsChangedListeners.forEach((listener) => listener());
}

const TRANSACTION_COLUMNS =
  "id, user_id, category_id, date, description, amount, type, recurring, note, categories(name)";

type TransactionRow = {
  id: string;
  user_id: string;
  category_id: string | null;
  date: string;
  description: string;
  amount: number | string;
  type: string;
  recurring: boolean;
  note: string | null;
  categories?: { name: string } | { name: string }[] | null;
};

export function asTransactionType(value: unknown) {
  return parseTransactionType(value);
}

export async function requireAuthUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) {
    throw new Error("You need to sign in before using transactions.");
  }

  const userId = data.user.id;
  if (!UUID_RE.test(userId)) {
    throw new Error("Your signed-in account ID is not a valid user id.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw friendlyError(profileError);
  if (!profile) {
    throw new Error(
      "No matching profile was found in public.users for this signed-in account."
    );
  }

  return userId;
}

function categoryName(row: TransactionRow): string {
  const c = row.categories;
  const name = Array.isArray(c) ? c[0]?.name : c?.name;
  return name || "Other";
}

function toTransaction(row: TransactionRow, category = categoryName(row)): Transaction {
  const rawAmount = typeof row.amount === "number" ? row.amount : Number(row.amount);
  const absAmount = Number.isFinite(rawAmount) ? Math.abs(rawAmount) : 0;
  const type = asTransactionType(row.type);
  return {
    id: row.id,
    date: row.date,
    description: row.description ?? "",
    category,
    amount: type === "expense" ? -absAmount : absAmount,
    type,
    recurring: row.recurring === true,
    note: row.note ?? undefined,
  };
}

async function toDbPayload(userId: string, tx: Omit<Transaction, "id"> & { id?: string }) {
  const type = parseTransactionType(tx.type);
  const categoryId = await categoryIdForName(tx.category || "Other", type, userId);
  return buildTransactionInsertFields({
    categoryId,
    userId,
    date: tx.date,
    description: tx.description,
    amount: tx.amount,
    selectedType: tx.type,
    recurring: tx.recurring,
    note: tx.note ?? null,
  });
}

export async function fetchTransactions(): Promise<Transaction[]> {
  const userId = await requireAuthUserId();
  const { data, error } = await supabase
    .from("transactions")
    .select(TRANSACTION_COLUMNS)
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (error) throw friendlyError(error);
  return (data as TransactionRow[] | null)?.map((row) => toTransaction(row as TransactionRow)) ?? [];
}

export async function insertTransaction(
  tx: Omit<Transaction, "id">
): Promise<Transaction> {
  const userId = await requireAuthUserId();
  const payload = await toDbPayload(userId, tx);
  const type = payload.type === "income" ? "income" : "expense";

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: payload.user_id,
      category_id: payload.category_id,
      date: payload.date,
      description: payload.description,
      amount: payload.amount,
      recurring: payload.recurring,
      note: payload.note,
      type,
    })
    .select(TRANSACTION_COLUMNS)
    .single();

  if (error) throw friendlyError(error);
  const saved = toTransaction(data as TransactionRow, tx.category);
  notifyTransactionsChanged();
  return saved;
}

export async function updateTransaction(tx: Transaction): Promise<Transaction> {
  const userId = await requireAuthUserId();
  const payload = await toDbPayload(userId, tx);
  const type = payload.type === "income" ? "income" : "expense";

  const { data, error } = await supabase
    .from("transactions")
    .update({
      category_id: payload.category_id,
      date: payload.date,
      description: payload.description,
      amount: payload.amount,
      recurring: payload.recurring,
      note: payload.note,
      type,
    })
    .eq("id", tx.id)
    .eq("user_id", userId)
    .select(TRANSACTION_COLUMNS)
    .single();

  if (error) throw friendlyError(error);
  if (!data) throw new Error("That transaction could not be updated.");
  const saved = toTransaction(data as TransactionRow, tx.category);
  notifyTransactionsChanged();
  return saved;
}

export async function deleteTransaction(id: string): Promise<void> {
  const userId = await requireAuthUserId();
  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) throw friendlyError(error);
  if (!data) throw new Error("That transaction could not be deleted.");
  notifyTransactionsChanged();
}
