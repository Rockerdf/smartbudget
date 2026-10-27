export type TransactionType = "income" | "expense";

export const MAX_DESCRIPTION_LENGTH = 200;
export const MAX_AMOUNT = 9_999_999_999.99; // numeric(12,2) in the database

export function parseTransactionType(value: unknown): TransactionType {
  if (typeof value !== "string") {
    throw new Error("Transaction type must be the string \"income\" or \"expense\".");
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "income") return "income";
  if (normalized === "expense") return "expense";
  throw new Error(`Invalid transaction type: ${value}`);
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function buildTransactionInsertFields(input: {
  userId: string;
  date: string;
  description: string;
  amount: number;
  selectedType: unknown;
  recurring: boolean;
  note?: string | null;
  categoryId?: string | null;
}) {
  const entryKind = parseTransactionType(input.selectedType);

  const amount = Math.round(Math.abs(Number(input.amount)) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be a number greater than zero.");
  }
  if (amount > MAX_AMOUNT) throw new Error("That amount is too large.");

  const description = String(input.description ?? "").trim();
  if (!description) throw new Error("Please describe the transaction.");
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`);
  }
  if (!isRealDate(input.date)) throw new Error("Please enter a valid date.");

  const row = {
    user_id: input.userId,
    category_id: input.categoryId ?? (null as string | null),
    date: input.date,
    description,
    amount,
    recurring: input.recurring === true,
    note: input.note ? String(input.note).trim().slice(0, 500) : null,
  };

  // Set `type` last with a string literal so it cannot be overwritten by amount or recurring.
  if (entryKind === "income") {
    return { ...row, type: "income" as const };
  }
  return { ...row, type: "expense" as const };
}
