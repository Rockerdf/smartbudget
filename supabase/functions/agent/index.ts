// SmartBudget AI agent: a Supabase Edge Function that talks to Google Gemini.
//
// The browser sends a message (plus any uploaded files). This function asks
// Gemini what to do, runs the tools Gemini picks (add transactions, set a
// budget, look up platform stats...) AS THE SIGNED-IN PERSON, so the database's
// Row Level Security and staff checks still apply to everything it does, and
// saves the conversation.
//
// Secrets (Supabase Dashboard -> Edge Functions -> Secrets):
//   GEMINI_API_KEY  required. Free key from https://aistudio.google.com/apikey
//   GEMINI_MODEL    optional. Defaults to "gemini-flash-latest".
// SUPABASE_URL is provided by Supabase automatically.
//
// Deploy with "Verify JWT" OFF: this function checks the sign-in itself.

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const GEMINI_BASE = Deno.env.get("GEMINI_BASE_URL") ?? "https://generativelanguage.googleapis.com";
const MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-flash-lite-latest";
// "Lite" is Google's fastest, least crowded model and handles this app's tasks well;
// the full Flash model is the backup. (Gemini 2.5 models are closed to new projects.)
const FALLBACK_MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest"];
// Supabase stops a function after about 150 seconds, so every reply must finish well before that.
const TOTAL_BUDGET_MS = 110_000;
const CALL_TIMEOUT_MS = 30_000;
const BUCKET = "agent-files";
const MAX_FILES = 6;
const INLINE_LIMIT = 7 * 1024 * 1024; // bigger files go through Gemini's File API
const MAX_STEPS = 8;
const HISTORY = 24;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Role = "user" | "support" | "admin" | "superadmin";
const STAFF: Role[] = ["support", "admin", "superadmin"];
type FileRef = { path: string; name: string; mime: string; size: number };
type Action = {
  id: string;
  tool: string;
  kind: "read" | "write";
  status: "done" | "failed" | "pending" | "cancelled";
  label: string;
  detail?: string;
  items?: string[];
  page?: string;
  args?: any;
};
type Ctx = {
  db: SupabaseClient;
  userId: string;
  role: Role;
  name: string;
  email: string;
  origin: string;
  today: string;
  files: FileRef[];
  cats?: { id: string; user_id: string | null; name: string; type: string }[];
};

class UserError extends Error {}

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const money = (n: number) => `$${Number(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const round2 = (n: number) => Math.round(n * 100) / 100;
const uid = () => crypto.randomUUID();
const isUuid = (s: unknown) => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const clean = (s: unknown, max: number) => (typeof s === "string" ? s.trim().slice(0, max) : "");
const likeSafe = (s: string) => s.replace(/[%_,()\\*]/g, " ").trim();

function todayIn(tz: string | undefined): string {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: tz || "Australia/Sydney" });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function monthRange(month: string | undefined, today: string) {
  const m = /^\d{4}-\d{2}$/.test(month ?? "") ? month! : today.slice(0, 7);
  const [y, mo] = m.split("-").map(Number);
  if (mo < 1 || mo > 12) throw new UserError("Month must look like 2026-10.");
  const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  return { month: m, start: `${m}-01`, end: `${next}-01` };
}

function validDate(d: unknown, today: string): string {
  if (d === undefined || d === null || d === "") return today;
  if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) {
    throw new UserError(`"${d}" is not a valid date (use YYYY-MM-DD).`);
  }
  if (d < "1990-01-01" || d > `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`) throw new UserError(`The date ${d} is out of range.`);
  return d;
}

function validAmount(a: unknown, label = "Amount"): number {
  const n = typeof a === "string" ? Number(a.replace(/[$,\s]/g, "")) : Number(a);
  if (!Number.isFinite(n) || n <= 0) throw new UserError(`${label} must be a number greater than 0.`);
  if (n > 9_999_999_999) throw new UserError(`${label} is too large.`);
  return round2(n);
}

function dbError(e: any): never {
  const msg = String(e?.message ?? e);
  if (/not allowed|permission denied|row-level security/i.test(msg)) throw new UserError("You don't have permission to do that.");
  throw new UserError(msg.replace(/^.*?:\s*/, "").slice(0, 200) || "The database refused that change.");
}

async function categoryList(ctx: Ctx) {
  if (!ctx.cats) {
    const { data, error } = await ctx.db.from("categories").select("id, user_id, name, type").order("name");
    if (error) dbError(error);
    ctx.cats = data ?? [];
  }
  return ctx.cats;
}

// Category names are matched loosely: any capitalisation, "and" or "&", plurals,
// and everyday words ("groceries", "uber", "salary") map to the built-in categories.
const normCat = (x: string) => x.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const CATEGORY_WORDS: Record<string, string> = {
  food: "Food & Dining", groceries: "Food & Dining", grocery: "Food & Dining", supermarket: "Food & Dining", restaurant: "Food & Dining",
  dining: "Food & Dining", "eating out": "Food & Dining", takeaway: "Food & Dining", coffee: "Food & Dining", cafe: "Food & Dining", lunch: "Food & Dining", dinner: "Food & Dining",
  rent: "Housing", mortgage: "Housing", home: "Housing", house: "Housing",
  transportation: "Transport", uber: "Transport", taxi: "Transport", fuel: "Transport", petrol: "Transport", gas: "Transport", car: "Transport", parking: "Transport", bus: "Transport", train: "Transport", opal: "Transport", myki: "Transport",
  movies: "Entertainment", movie: "Entertainment", games: "Entertainment", fun: "Entertainment", concert: "Entertainment",
  health: "Healthcare", medical: "Healthcare", doctor: "Healthcare", pharmacy: "Healthcare", chemist: "Healthcare", dentist: "Healthcare",
  clothes: "Shopping", clothing: "Shopping", shoes: "Shopping",
  school: "Education", uni: "Education", university: "Education", tuition: "Education", course: "Education", books: "Education",
  bills: "Utilities", electricity: "Utilities", power: "Utilities", water: "Utilities", internet: "Utilities", phone: "Utilities", mobile: "Utilities",
  saving: "Savings", holiday: "Travel", holidays: "Travel", flights: "Travel", flight: "Travel", hotel: "Travel", trip: "Travel",
  subscription: "Subscriptions", netflix: "Subscriptions", spotify: "Subscriptions", streaming: "Subscriptions",
  haircut: "Personal Care", beauty: "Personal Care", gym: "Personal Care",
  misc: "Other", miscellaneous: "Other", general: "Other",
  salary: "Income", wage: "Income", wages: "Income", pay: "Income", paycheck: "Income", payslip: "Income", bonus: "Income", refund: "Income",
};

function findCategory(rows: { id: string; user_id: string | null; name: string; type: string }[], name: string) {
  const want = normCat(name);
  if (!want) return undefined;
  const byNorm = (n: string) => rows.find((c) => c.user_id && normCat(c.name) === n) ?? rows.find((c) => normCat(c.name) === n);
  const singular = want.replace(/ies$/, "y").replace(/s$/, "");
  const alias = CATEGORY_WORDS[want] ?? CATEGORY_WORDS[singular];
  const hit = byNorm(want) ?? byNorm(singular) ?? (alias ? byNorm(normCat(alias)) : undefined);
  if (hit) return hit;
  if (want.length >= 4) {
    const partial = rows.filter((c) => normCat(c.name).startsWith(want) || want.startsWith(normCat(c.name)));
    if (partial.length === 1) return partial[0];
  }
  return undefined;
}

async function categoryId(ctx: Ctx, name: string, type: "income" | "expense"): Promise<string | null> {
  const wanted = clean(name, 60) || (type === "income" ? "Income" : "Other");
  const rows = await categoryList(ctx);
  const hit = findCategory(rows, wanted);
  if (hit) return hit.id;
  // A genuinely new category: tidy the capitalisation ("pet care" -> "Pet Care").
  const nice = wanted.replace(/\s+/g, " ").replace(/\b([a-z])/g, (m) => m.toUpperCase());
  const { data, error } = await ctx.db.from("categories")
    .insert({ user_id: ctx.userId, name: nice, type, is_system: false })
    .select("id, user_id, name, type").single();
  if (error) dbError(error);
  ctx.cats!.push(data);
  return data.id;
}

/** Lower-cases the fixed-choice arguments the AI sends ("Income" -> "income"). */
function normalizeArgs(args: any): any {
  if (Array.isArray(args)) return args.map(normalizeArgs);
  if (!args || typeof args !== "object") return args;
  const out: any = {};
  for (const [k, v] of Object.entries(args)) {
    if (["type", "status", "role", "kind"].includes(k) && typeof v === "string") out[k] = v.trim().toLowerCase();
    else if (k === "email" && typeof v === "string") out[k] = v.trim().toLowerCase();
    else out[k] = normalizeArgs(v);
  }
  return out;
}

const catName = (row: any) => (Array.isArray(row?.categories) ? row.categories[0]?.name : row?.categories?.name) ?? "Other";

function resolveFile(ctx: Ctx, ref: unknown): string | null {
  if (!ref || typeof ref !== "string") return null;
  const r = ref.trim();
  const f = ctx.files.find((x) => x.path === r) ?? ctx.files.find((x) => x.name.toLowerCase() === r.toLowerCase());
  if (!f) throw new UserError(`I can't find an uploaded file called "${r}".`);
  if (!f.path.startsWith(ctx.userId + "/")) throw new UserError("That file does not belong to you.");
  return f.path;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tools
// ─────────────────────────────────────────────────────────────────────────────
type Tool = {
  name: string;
  description: string;
  parameters?: any;
  who: "user" | "staff" | "admin" | "superadmin";
  kind: "read" | "write";
  /** Needs the person to press Approve before it runs. */
  confirm?: boolean;
  /** For confirm tools: checks the request and returns a plain-English summary. */
  preview?: (ctx: Ctx, a: any) => Promise<{ label: string; items?: string[] }>;
  run: (ctx: Ctx, a: any) => Promise<{ result: any; label: string; items?: string[]; page?: string }>;
};

const S = (description: string, extra: any = {}) => ({ type: "STRING", description, ...extra });
const N = (description: string) => ({ type: "NUMBER", description });
const B = (description: string) => ({ type: "BOOLEAN", description });
const OBJ = (properties: any, required: string[] = []) => ({ type: "OBJECT", properties, required });

const USER_PAGES = ["dashboard", "transactions", "budget", "savings", "analytics", "healthScore", "education", "notifications", "settings", "helpCenter"];
const STAFF_PAGES = ["adminDashboard", "adminUsers", "adminReports", "adminSecurity", "adminAuditLogs", "adminContent", "adminSystemSettings", "adminRoles"];

async function findGoal(ctx: Ctx, ref: unknown) {
  const r = clean(ref, 100);
  if (!r) throw new UserError("Which goal? Give its name.");
  const { data, error } = await ctx.db.from("savings_goals").select("id, name, target_amount, current_amount, deadline, monthly_contribution");
  if (error) dbError(error);
  const goals = data ?? [];
  const exact = goals.filter((g: any) => g.id === r || g.name.toLowerCase() === r.toLowerCase());
  const matches = exact.length ? exact : goals.filter((g: any) => g.name.toLowerCase().includes(r.toLowerCase()));
  if (matches.length === 0) throw new UserError(`No savings goal matches "${r}". Your goals: ${goals.map((g: any) => g.name).join(", ") || "none yet"}.`);
  if (matches.length > 1) throw new UserError(`Several goals match "${r}": ${matches.map((g: any) => g.name).join(", ")}. Which one?`);
  return matches[0];
}

async function findUserByEmail(ctx: Ctx, email: unknown) {
  const e = clean(email, 254).toLowerCase();
  if (!e.includes("@")) throw new UserError("Give the person's email address.");
  const { data, error } = await ctx.db.from("users").select("id, name, email, role, status").ilike("email", likeSafe(e).replace(/ /g, "_")).limit(2);
  if (error) dbError(error);
  const hit = (data ?? []).find((u: any) => u.email.toLowerCase() === e);
  if (!hit) throw new UserError(`No account uses ${e}.`);
  return hit;
}

const TOOLS: Tool[] = [
  // ── Personal finance (regular users) ──────────────────────────────────────
  {
    name: "get_financial_summary",
    who: "user", kind: "read",
    description: "Overview of the person's money for one month: income, expenses, net, spending by category, budgets (with amount spent), savings goals and all-time balance.",
    parameters: OBJ({ month: S("Month as YYYY-MM. Defaults to the current month.") }),
    async run(ctx, a) {
      const { month, start, end } = monthRange(a.month, ctx.today);
      const [tx, all, budgets, goals] = await Promise.all([
        ctx.db.from("transactions").select("amount, type, categories(name)").gte("date", start).lt("date", end).limit(5000),
        ctx.db.from("transactions").select("amount, type").limit(20000),
        ctx.db.from("budgets").select("amount_budgeted, categories(name)").eq("period_start", start),
        ctx.db.from("savings_goals").select("name, target_amount, current_amount, deadline, monthly_contribution"),
      ]);
      for (const r of [tx, all, budgets, goals]) if (r.error) dbError(r.error);
      let income = 0, expenses = 0;
      const byCat: Record<string, number> = {};
      for (const t of tx.data ?? []) {
        const amt = Number(t.amount);
        if (t.type === "income") income += amt;
        else { expenses += amt; byCat[catName(t)] = round2((byCat[catName(t)] ?? 0) + amt); }
      }
      let balance = 0;
      for (const t of all.data ?? []) balance += t.type === "income" ? Number(t.amount) : -Number(t.amount);
      return {
        label: `Checked your ${month} summary`,
        result: {
          month, income: round2(income), expenses: round2(expenses), net: round2(income - expenses),
          transactions_this_month: (tx.data ?? []).length,
          spending_by_category: Object.entries(byCat).sort((x, y) => y[1] - x[1]).map(([category, total]) => ({ category, total })),
          budgets: (budgets.data ?? []).map((b: any) => ({ category: catName(b), budgeted: Number(b.amount_budgeted), spent: byCat[catName(b)] ?? 0 })),
          savings_goals: (goals.data ?? []).map((g: any) => ({ name: g.name, saved: Number(g.current_amount), target: Number(g.target_amount), deadline: g.deadline, monthly_contribution: Number(g.monthly_contribution) })),
          all_time_balance_from_recorded_transactions: round2(balance),
          currency: "AUD",
        },
      };
    },
  },
  {
    name: "list_transactions",
    who: "user", kind: "read",
    description: "Find the person's transactions. Returns id, date, description, category, amount, type, note and whether a receipt is attached. Use it before updating or deleting so you have the right ids.",
    parameters: OBJ({
      from: S("Earliest date YYYY-MM-DD"), to: S("Latest date YYYY-MM-DD"),
      type: S("income or expense", { enum: ["income", "expense"] }),
      category: S("Category name"), search: S("Words in the description or note"),
      min_amount: N("Smallest amount"), max_amount: N("Largest amount"),
      limit: { type: "INTEGER", description: "How many (default 25, max 100)" },
    }),
    async run(ctx, a) {
      let q = ctx.db.from("transactions")
        .select("id, date, description, amount, type, recurring, note, receipt_path, categories(name)", { count: "exact" })
        .order("date", { ascending: false }).order("created_at", { ascending: false })
        .limit(Math.min(Math.max(Number(a.limit) || 25, 1), 100));
      if (a.from) q = q.gte("date", validDate(a.from, ctx.today));
      if (a.to) q = q.lte("date", validDate(a.to, ctx.today));
      if (a.type === "income" || a.type === "expense") q = q.eq("type", a.type);
      if (Number.isFinite(Number(a.min_amount)) && a.min_amount !== undefined) q = q.gte("amount", Number(a.min_amount));
      if (Number.isFinite(Number(a.max_amount)) && a.max_amount !== undefined) q = q.lte("amount", Number(a.max_amount));
      if (a.category) {
        const rows = await categoryList(ctx);
        const match = findCategory(rows, clean(a.category, 60));
        const ids = match ? rows.filter((c) => normCat(c.name) === normCat(match.name)).map((c) => c.id) : [];
        if (!ids.length) return { label: "Searched your transactions", result: { count: 0, transactions: [], note: `No category called ${a.category}.` } };
        q = q.in("category_id", ids);
      }
      const s = likeSafe(clean(a.search, 80));
      if (s) q = q.or(`description.ilike.*${s}*,note.ilike.*${s}*`);
      const { data, error, count } = await q;
      if (error) dbError(error);
      return {
        label: `Looked up your transactions (${count ?? 0} found)`,
        result: {
          total_matching: count,
          transactions: (data ?? []).map((t: any) => ({
            id: t.id, date: t.date, description: t.description, category: catName(t), amount: Number(t.amount),
            type: t.type, recurring: t.recurring, note: t.note ?? undefined, has_receipt: !!t.receipt_path,
          })),
        },
      };
    },
  },
  {
    name: "add_transactions",
    who: "user", kind: "write",
    description: "Record one or more income/expense transactions (max 50). Amounts are always positive; 'type' says if money came in or went out. Attach the uploaded receipt with receipt_file. Possible duplicates (same date, amount and type already recorded) are skipped and returned unless allow_duplicates is true; ask the person before retrying with allow_duplicates.",
    parameters: OBJ({
      transactions: {
        type: "ARRAY",
        items: OBJ({
          date: S("YYYY-MM-DD. Defaults to today."),
          description: S("Short description, e.g. the shop name"),
          amount: N("Positive amount in dollars"),
          type: S("income or expense", { enum: ["income", "expense"] }),
          category: S("Category, e.g. Food & Dining, Transport, Housing, Shopping, Utilities, Entertainment, Healthcare, Education, Travel, Subscriptions, Personal Care, Savings, Income, Other"),
          note: S("Optional note"),
          recurring: B("True if it repeats every month"),
          receipt_file: S("Name of an uploaded file to keep as the receipt"),
        }, ["description", "amount", "type"]),
      },
      allow_duplicates: B("Add even if it looks like a duplicate"),
    }, ["transactions"]),
    async run(ctx, a) {
      const list = Array.isArray(a.transactions) ? a.transactions : [];
      if (!list.length) throw new UserError("No transactions were given.");
      if (list.length > 50) throw new UserError("Please add at most 50 transactions at a time.");
      const rows: any[] = [];
      for (const t of list) {
        const type = t.type === "income" ? "income" : "expense";
        const description = clean(t.description, 200);
        if (!description) throw new UserError("Each transaction needs a description.");
        rows.push({
          user_id: ctx.userId,
          date: validDate(t.date, ctx.today),
          description,
          amount: validAmount(t.amount),
          type,
          category_id: await categoryId(ctx, t.category, type),
          note: clean(t.note, 500) || null,
          recurring: t.recurring === true,
          receipt_path: resolveFile(ctx, t.receipt_file),
        });
      }
      let toInsert = rows;
      const skipped: any[] = [];
      if (a.allow_duplicates !== true) {
        const dates = [...new Set(rows.map((r) => r.date))];
        const { data: existing, error } = await ctx.db.from("transactions").select("date, amount, type, description").in("date", dates);
        if (error) dbError(error);
        toInsert = rows.filter((r) => {
          const dup = (existing ?? []).find((e: any) => e.date === r.date && Number(e.amount) === r.amount && e.type === r.type);
          if (dup) skipped.push({ date: r.date, amount: r.amount, description: r.description, existing_description: dup.description });
          return !dup;
        });
      }
      let saved: any[] = [];
      if (toInsert.length) {
        const { data, error } = await ctx.db.from("transactions").insert(toInsert).select("id, date, description, amount, type, receipt_path");
        if (error) dbError(error);
        saved = data ?? [];
      }
      const items = saved.map((t: any) => `${t.type === "income" ? "+" : "−"}${money(t.amount)} · ${t.description} · ${t.date}${t.receipt_path ? " · receipt attached" : ""}`);
      return {
        label: saved.length ? `Added ${saved.length} transaction${saved.length > 1 ? "s" : ""}` : "No transactions added",
        items: [...items, ...skipped.map((s) => `Skipped (possible duplicate): ${money(s.amount)} · ${s.description} · ${s.date}`)],
        page: saved.length ? "transactions" : undefined,
        result: { added: saved.map((t: any) => ({ id: t.id, date: t.date, description: t.description, amount: Number(t.amount), type: t.type })), skipped_possible_duplicates: skipped },
      };
    },
  },
  {
    name: "update_transaction",
    who: "user", kind: "write",
    description: "Change one existing transaction by id (get the id from list_transactions first). Only give the fields that change.",
    parameters: OBJ({
      id: S("Transaction id"), date: S("YYYY-MM-DD"), description: S("Description"), amount: N("Positive amount"),
      type: S("income or expense", { enum: ["income", "expense"] }), category: S("Category name"), note: S("Note"),
      recurring: B("Repeats monthly"), receipt_file: S("Uploaded file to attach as receipt"),
    }, ["id"]),
    async run(ctx, a) {
      if (!isUuid(a.id)) throw new UserError("I need the transaction's id. Look it up with list_transactions first.");
      const { data: cur, error: e1 } = await ctx.db.from("transactions").select("id, type, description").eq("id", a.id).maybeSingle();
      if (e1) dbError(e1);
      if (!cur) throw new UserError("That transaction was not found.");
      const patch: any = {};
      const type = a.type === "income" || a.type === "expense" ? a.type : cur.type;
      if (a.type) patch.type = type;
      if (a.date !== undefined) patch.date = validDate(a.date, ctx.today);
      if (a.description !== undefined) patch.description = clean(a.description, 200) || cur.description;
      if (a.amount !== undefined) patch.amount = validAmount(a.amount);
      if (a.category) patch.category_id = await categoryId(ctx, a.category, type);
      if (a.note !== undefined) patch.note = clean(a.note, 500) || null;
      if (typeof a.recurring === "boolean") patch.recurring = a.recurring;
      if (a.receipt_file) patch.receipt_path = resolveFile(ctx, a.receipt_file);
      if (!Object.keys(patch).length) throw new UserError("Nothing to change.");
      const { data, error } = await ctx.db.from("transactions").update(patch).eq("id", a.id).select("id, date, description, amount, type").single();
      if (error) dbError(error);
      return { label: `Updated “${data.description}”`, items: [`${money(data.amount)} · ${data.type} · ${data.date}`], page: "transactions", result: { updated: data } };
    },
  },
  {
    name: "delete_transactions",
    who: "user", kind: "write", confirm: true,
    description: "Delete transactions by id. The person must approve before anything is deleted.",
    parameters: OBJ({ ids: { type: "ARRAY", items: S("Transaction id"), description: "Ids from list_transactions" } }, ["ids"]),
    async preview(ctx, a) {
      const ids = (Array.isArray(a.ids) ? a.ids : []).filter(isUuid).slice(0, 100);
      if (!ids.length) throw new UserError("I need the transaction ids. Look them up with list_transactions first.");
      const { data, error } = await ctx.db.from("transactions").select("id, date, description, amount, type").in("id", ids);
      if (error) dbError(error);
      if (!data?.length) throw new UserError("None of those transactions were found.");
      a.ids = data.map((t: any) => t.id);
      return { label: `Delete ${data.length} transaction${data.length > 1 ? "s" : ""}`, items: data.map((t: any) => `${money(t.amount)} · ${t.description} · ${t.date}`) };
    },
    async run(ctx, a) {
      const { data, error } = await ctx.db.from("transactions").delete().in("id", a.ids).select("id");
      if (error) dbError(error);
      return { label: `Deleted ${data?.length ?? 0} transaction${data?.length === 1 ? "" : "s"}`, page: "transactions", result: { deleted: data?.length ?? 0 } };
    },
  },
  {
    name: "list_categories",
    who: "user", kind: "read",
    description: "All categories the person can use (built-in and their own).",
    async run(ctx) {
      const rows = await categoryList(ctx);
      return { label: "Checked your categories", result: rows.map((c) => ({ name: c.name, type: c.type, custom: !!c.user_id })) };
    },
  },
  {
    name: "set_budget",
    who: "user", kind: "write",
    description: "Create or change the monthly budget for one spending category.",
    parameters: OBJ({ category: S("Expense category"), amount: N("Monthly budget in dollars"), month: S("YYYY-MM, defaults to this month") }, ["category", "amount"]),
    async run(ctx, a) {
      const { month, start } = monthRange(a.month, ctx.today);
      const amount = validAmount(a.amount, "Budget");
      const cid = await categoryId(ctx, a.category, "expense");
      const { data: existing, error: e1 } = await ctx.db.from("budgets").select("id").eq("period_start", start).eq("category_id", cid).maybeSingle();
      if (e1) dbError(e1);
      const q = existing
        ? ctx.db.from("budgets").update({ amount_budgeted: amount }).eq("id", existing.id)
        : ctx.db.from("budgets").insert({ user_id: ctx.userId, category_id: cid, period_start: start, amount_budgeted: amount });
      const { error } = await q;
      if (error) dbError(error);
      const cname = (await categoryList(ctx)).find((c) => c.id === cid)?.name ?? a.category;
      return { label: `${existing ? "Updated" : "Set"} ${cname} budget to ${money(amount)}`, items: [`For ${month}`], page: "budget", result: { category: cname, month, amount } };
    },
  },
  {
    name: "delete_budget",
    who: "user", kind: "write", confirm: true,
    description: "Remove the budget for one category in a month. Needs the person's approval.",
    parameters: OBJ({ category: S("Category"), month: S("YYYY-MM, defaults to this month") }, ["category"]),
    async preview(ctx, a) {
      const { month, start } = monthRange(a.month, ctx.today);
      const rows = await categoryList(ctx);
      const match = findCategory(rows, clean(a.category, 60));
      const ids = match ? rows.filter((c) => normCat(c.name) === normCat(match.name)).map((c) => c.id) : [];
      if (match) a.category = match.name;
      const { data, error } = ids.length
        ? await ctx.db.from("budgets").select("id, amount_budgeted").eq("period_start", start).in("category_id", ids)
        : { data: [], error: null };
      if (error) dbError(error);
      if (!data?.length) throw new UserError(`There is no ${a.category} budget for ${month}.`);
      a.budget_id = data[0].id;
      return { label: `Remove the ${a.category} budget (${money(data[0].amount_budgeted)}) for ${month}` };
    },
    async run(ctx, a) {
      const { error } = await ctx.db.from("budgets").delete().eq("id", a.budget_id);
      if (error) dbError(error);
      return { label: `Removed the ${a.category} budget`, page: "budget", result: { ok: true } };
    },
  },
  {
    name: "list_goals",
    who: "user", kind: "read",
    description: "The person's savings goals with progress.",
    async run(ctx) {
      const { data, error } = await ctx.db.from("savings_goals").select("name, target_amount, current_amount, deadline, monthly_contribution, created_at").order("created_at");
      if (error) dbError(error);
      return { label: "Checked your savings goals", result: (data ?? []).map((g: any) => ({ name: g.name, saved: Number(g.current_amount), target: Number(g.target_amount), deadline: g.deadline, monthly_contribution: Number(g.monthly_contribution) })) };
    },
  },
  {
    name: "create_goal",
    who: "user", kind: "write",
    description: "Create a savings goal.",
    parameters: OBJ({
      name: S("Goal name"), target_amount: N("Target in dollars"), current_amount: N("Already saved (default 0)"),
      deadline: S("YYYY-MM-DD (optional)"), monthly_contribution: N("Planned monthly saving (optional)"), icon: S("One emoji (optional)"),
    }, ["name", "target_amount"]),
    async run(ctx, a) {
      const name = clean(a.name, 80);
      if (!name) throw new UserError("The goal needs a name.");
      const row: any = {
        user_id: ctx.userId, name, target_amount: validAmount(a.target_amount, "Target"),
        current_amount: a.current_amount ? round2(Math.max(0, Number(a.current_amount) || 0)) : 0,
        monthly_contribution: a.monthly_contribution ? round2(Math.max(0, Number(a.monthly_contribution) || 0)) : 0,
        deadline: a.deadline ? validDate(a.deadline, ctx.today.replace(/^\d{4}/, (y) => String(Number(y) + 30))) : null,
      };
      if (typeof a.icon === "string" && a.icon.trim() && [...a.icon.trim()].length <= 2) row.icon = a.icon.trim();
      const { data, error } = await ctx.db.from("savings_goals").insert(row).select("name, target_amount").single();
      if (error) dbError(error);
      return { label: `Created goal “${data.name}”`, items: [`Target ${money(data.target_amount)}`], page: "savings", result: { created: data } };
    },
  },
  {
    name: "update_goal",
    who: "user", kind: "write",
    description: "Change a savings goal, or add money to it (add_amount; negative to take money out).",
    parameters: OBJ({
      goal: S("Goal name"), add_amount: N("Dollars to add to the saved amount"), current_amount: N("New saved amount"),
      target_amount: N("New target"), deadline: S("New deadline YYYY-MM-DD"), monthly_contribution: N("New monthly contribution"), name: S("New name"),
    }, ["goal"]),
    async run(ctx, a) {
      const g = await findGoal(ctx, a.goal);
      const patch: any = {};
      if (a.add_amount !== undefined) patch.current_amount = round2(Math.max(0, Number(g.current_amount) + (Number(a.add_amount) || 0)));
      if (a.current_amount !== undefined) patch.current_amount = round2(Math.max(0, Number(a.current_amount) || 0));
      if (a.target_amount !== undefined) patch.target_amount = validAmount(a.target_amount, "Target");
      if (a.monthly_contribution !== undefined) patch.monthly_contribution = round2(Math.max(0, Number(a.monthly_contribution) || 0));
      if (a.deadline !== undefined) patch.deadline = a.deadline ? validDate(a.deadline, ctx.today.replace(/^\d{4}/, (y) => String(Number(y) + 30))) : null;
      if (a.name) patch.name = clean(a.name, 80);
      if (!Object.keys(patch).length) throw new UserError("Nothing to change.");
      const { data, error } = await ctx.db.from("savings_goals").update(patch).eq("id", g.id).select("name, current_amount, target_amount").single();
      if (error) dbError(error);
      return { label: `Updated goal “${data.name}”`, items: [`${money(data.current_amount)} of ${money(data.target_amount)} saved`], page: "savings", result: { updated: data } };
    },
  },
  {
    name: "delete_goal",
    who: "user", kind: "write", confirm: true,
    description: "Delete a savings goal. Needs the person's approval.",
    parameters: OBJ({ goal: S("Goal name") }, ["goal"]),
    async preview(ctx, a) {
      const g = await findGoal(ctx, a.goal);
      a.goal_id = g.id;
      return { label: `Delete the goal “${g.name}”`, items: [`${money(g.current_amount)} of ${money(g.target_amount)} saved`] };
    },
    async run(ctx, a) {
      const { error } = await ctx.db.from("savings_goals").delete().eq("id", a.goal_id);
      if (error) dbError(error);
      return { label: "Deleted the goal", page: "savings", result: { ok: true } };
    },
  },

  // ── Staff tools (permissions are checked again by the database) ───────────
  {
    name: "platform_overview",
    who: "staff", kind: "read",
    description: "Live platform numbers: users, active people, sign-ins, failed sign-ins, feature adoption, recent activity, newest accounts, AI agent usage.",
    async run(ctx) {
      const [{ data, error }, agent] = await Promise.all([ctx.db.rpc("admin_dashboard_stats"), ctx.db.rpc("admin_agent_stats")]);
      if (error) dbError(error);
      return { label: "Checked platform statistics", result: { ...data, ai_agent: agent.data ?? null } };
    },
  },
  {
    name: "platform_report",
    who: "staff", kind: "read",
    description: "Monthly report: user activity, combined financial activity (totals only), spending by category (only categories used by 3+ people), lesson engagement, security summary.",
    parameters: OBJ({ months: { type: "INTEGER", description: "3, 6 or 12 (default 6)" } }),
    async run(ctx, a) {
      const months = [3, 6, 12].includes(Number(a.months)) ? Number(a.months) : 6;
      const { data, error } = await ctx.db.rpc("admin_reports", { p_months: months });
      if (error) dbError(error);
      return { label: `Built a ${months}-month platform report`, page: "adminReports", result: data };
    },
  },
  {
    name: "lesson_stats",
    who: "staff", kind: "read",
    description: "How many people started and completed each lesson.",
    async run(ctx) {
      const { data, error } = await ctx.db.rpc("admin_lesson_stats");
      if (error) dbError(error);
      return { label: "Checked lesson statistics", result: data };
    },
  },
  {
    name: "find_users",
    who: "staff", kind: "read",
    description: "Search accounts by name or email, role or status. Returns name, email, role, status, last sign-in and join date (never financial data).",
    parameters: OBJ({
      search: S("Part of a name or email"),
      role: S("user, support, admin or superadmin", { enum: ["user", "support", "admin", "superadmin"] }),
      status: S("active or suspended", { enum: ["active", "suspended"] }),
      limit: { type: "INTEGER", description: "Default 25, max 100" },
    }),
    async run(ctx, a) {
      let q = ctx.db.from("users").select("name, email, role, status, last_login, created_at", { count: "exact" })
        .order("created_at", { ascending: false }).limit(Math.min(Math.max(Number(a.limit) || 25, 1), 100));
      const s = likeSafe(clean(a.search, 80));
      if (s) q = q.or(`name.ilike.*${s}*,email.ilike.*${s}*`);
      if (a.role) q = q.eq("role", a.role);
      if (a.status) q = q.eq("status", a.status);
      const { data, error, count } = await q;
      if (error) dbError(error);
      return { label: `Searched accounts (${count ?? 0} found)`, page: "adminUsers", result: { total_matching: count, users: data } };
    },
  },
  {
    name: "security_overview",
    who: "admin", kind: "read",
    description: "Security Center data: sign-in counts, failed sign-ins with IP and device, open alerts.",
    async run(ctx) {
      const { data, error } = await ctx.db.rpc("admin_security_overview");
      if (error) dbError(error);
      return { label: "Checked the Security Center", page: "adminSecurity", result: data };
    },
  },
  {
    name: "activity_log",
    who: "admin", kind: "read",
    description: "Search the activity log of staff actions and sign-in events.",
    parameters: OBJ({
      kind: S("all, admin (staff actions) or auth (sign-in events)", { enum: ["all", "admin", "auth"] }),
      search: S("Email, action or IP to look for"),
      since: S("Only events after this date YYYY-MM-DD"),
      limit: { type: "INTEGER", description: "Default 30, max 200" },
    }),
    async run(ctx, a) {
      const { data, error } = await ctx.db.rpc("admin_activity_log", {
        p_kind: ["all", "admin", "auth"].includes(a.kind) ? a.kind : "all",
        p_search: clean(a.search, 100) || null,
        p_limit: Math.min(Math.max(Number(a.limit) || 30, 1), 200),
        p_offset: 0,
        p_since: a.since ? validDate(a.since, ctx.today) : null,
      });
      if (error) dbError(error);
      return { label: "Searched the activity log", page: "adminAuditLogs", result: data };
    },
  },
  {
    name: "set_user_status",
    who: "admin", kind: "write", confirm: true,
    description: "Suspend or reactivate an account by email. Needs approval. Admins cannot change other staff; nobody can change themselves.",
    parameters: OBJ({ email: S("Account email"), status: S("suspended or active", { enum: ["suspended", "active"] }) }, ["email", "status"]),
    async preview(ctx, a) {
      if (a.status !== "suspended" && a.status !== "active") throw new UserError("Status must be suspended or active.");
      const u = await findUserByEmail(ctx, a.email);
      if (u.id === ctx.userId) throw new UserError("You can't change your own account status.");
      if (u.status === a.status) throw new UserError(`${u.email} is already ${u.status}.`);
      if (ctx.role === "admin" && STAFF.includes(u.role)) throw new UserError("Admins can't suspend other staff accounts.");
      a.user_id = u.id;
      return { label: `${a.status === "suspended" ? "Suspend" : "Reactivate"} ${u.name || u.email}`, items: [`${u.email} · ${u.role}`] };
    },
    async run(ctx, a) {
      const { error } = await ctx.db.rpc("admin_set_status", { target: a.user_id, new_status: a.status });
      if (error) dbError(error);
      return { label: `${a.status === "suspended" ? "Suspended" : "Reactivated"} ${a.email}`, page: "adminUsers", result: { ok: true } };
    },
  },
  {
    name: "set_user_role",
    who: "superadmin", kind: "write", confirm: true,
    description: "Change an account's role (user, support, admin, superadmin). Super admins only. Needs approval.",
    parameters: OBJ({ email: S("Account email"), role: S("New role", { enum: ["user", "support", "admin", "superadmin"] }) }, ["email", "role"]),
    async preview(ctx, a) {
      if (!["user", "support", "admin", "superadmin"].includes(a.role)) throw new UserError("Unknown role.");
      const u = await findUserByEmail(ctx, a.email);
      if (u.id === ctx.userId) throw new UserError("You can't change your own role.");
      if (u.role === a.role) throw new UserError(`${u.email} is already ${u.role}.`);
      a.user_id = u.id;
      return { label: `Change ${u.name || u.email} from ${u.role} to ${a.role}`, items: [u.email] };
    },
    async run(ctx, a) {
      const { error } = await ctx.db.rpc("admin_set_role", { target: a.user_id, new_role: a.role });
      if (error) dbError(error);
      return { label: `${a.email} is now ${a.role}`, page: "adminUsers", result: { ok: true } };
    },
  },
  {
    name: "send_password_reset",
    who: "staff", kind: "write", confirm: true,
    description: "Email a password-reset link to an account. Needs approval.",
    parameters: OBJ({ email: S("Account email") }, ["email"]),
    async preview(ctx, a) {
      const u = await findUserByEmail(ctx, a.email);
      a.email = u.email;
      return { label: `Send a password-reset email to ${u.email}` };
    },
    async run(ctx, a) {
      const { error } = await ctx.db.auth.resetPasswordForEmail(a.email, ctx.origin ? { redirectTo: ctx.origin } : undefined);
      if (error) throw new UserError(error.message);
      await ctx.db.rpc("log_admin_action", { p_action: "password_reset_sent", p_target_label: a.email, p_details: { via: "ai_agent" } });
      return { label: `Password-reset email sent to ${a.email}`, result: { ok: true } };
    },
  },
  {
    name: "update_site_settings",
    who: "superadmin", kind: "write", confirm: true,
    description: "Change site settings: maintenance mode and message, sign-ups on/off, AI agent on/off, announcement banner and text, AI usage limits per person. Super admins only. Needs approval.",
    parameters: OBJ({
      maintenance_mode: B("Maintenance mode on"), maintenance_message: S("Maintenance message (max 300 chars)"),
      signups_enabled: B("Allow new sign-ups"), assistant_enabled: B("AI agent available to users"),
      announcement_enabled: B("Show announcement banner"), announcement: S("Announcement text (max 300 chars)"),
      agent_hourly_limit: { type: "INTEGER", description: "AI messages per person per hour" },
      agent_daily_limit: { type: "INTEGER", description: "AI messages per person per day" },
    }),
    async preview(_ctx, a) {
      const keys = ["maintenance_mode", "maintenance_message", "signups_enabled", "assistant_enabled", "announcement_enabled", "announcement", "agent_hourly_limit", "agent_daily_limit"];
      const settings: any = {};
      for (const k of keys) if (a[k] !== undefined && a[k] !== null) settings[k] = a[k];
      if (!Object.keys(settings).length) throw new UserError("No settings to change.");
      for (const k of Object.keys(a)) if (!keys.includes(k) || a[k] === null || a[k] === undefined) delete a[k];
      const names: Record<string, string> = {
        maintenance_mode: "Maintenance mode", maintenance_message: "Maintenance message", signups_enabled: "New sign-ups",
        assistant_enabled: "AI agent for users", announcement_enabled: "Announcement banner", announcement: "Announcement text",
        agent_hourly_limit: "AI messages per hour", agent_daily_limit: "AI messages per day",
      };
      return {
        label: "Change site settings",
        items: Object.entries(settings).map(([k, v]) => `${names[k]}: ${typeof v === "boolean" ? (v ? "on" : "off") : String(v)}`),
      };
    },
    async run(ctx, a) {
      const { error } = await ctx.db.rpc("admin_update_settings", { p_settings: a });
      if (error) dbError(error);
      return { label: "Site settings updated", page: "adminSystemSettings", result: { ok: true } };
    },
  },

  // ── Everyone ──────────────────────────────────────────────────────────────
  {
    name: "open_page",
    who: "user", kind: "read",
    description: "Show the person a button that opens a page of the app.",
    parameters: OBJ({ page: S("Page id", { enum: [...USER_PAGES, ...STAFF_PAGES] }) }, ["page"]),
    async run(ctx, a) {
      const allowed = STAFF.includes(ctx.role) ? STAFF_PAGES : USER_PAGES;
      const page = allowed.find((p) => p.toLowerCase() === String(a.page ?? "").toLowerCase().replace(/[\s_-]/g, ""));
      if (!page) throw new UserError("That page isn't available for this account.");
      a.page = page;
      return { label: "Open page", page: a.page, result: { ok: true, note: "A button to open the page is shown." } };
    },
  },
];

function toolsFor(role: Role): Tool[] {
  const staff = STAFF.includes(role);
  return TOOLS.filter((t) => {
    if (t.name === "open_page") return true;
    if (t.who === "user") return !staff; // staff accounts have no personal finance pages
    if (t.who === "staff") return staff;
    if (t.who === "admin") return role === "admin" || role === "superadmin";
    return role === "superadmin";
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Files -> Gemini parts
// ─────────────────────────────────────────────────────────────────────────────
const IMAGE = /^image\/(png|jpe?g|webp|heic|heif)$/i;
const TEXTISH = /^(text\/|application\/(json|xml|csv))/i;
const SHEET = /(spreadsheetml|ms-excel|opendocument\.spreadsheet)/i;
const DOCX = /wordprocessingml/i;

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function uploadToGemini(key: string, bytes: Uint8Array, mime: string, name: string) {
  const start = await fetch(`${GEMINI_BASE}/upload/v1beta/files`, {
    method: "POST",
    headers: {
      "x-goog-api-key": key, "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.length), "X-Goog-Upload-Header-Content-Type": mime, "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: name.slice(0, 100) } }),
  });
  const url = start.headers.get("x-goog-upload-url");
  if (!start.ok || !url) throw new Error(`upload start ${start.status}`);
  const up = await fetch(url, { method: "POST", headers: { "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" }, body: new Blob([bytes as BlobPart]) });
  if (!up.ok) throw new Error(`upload ${up.status}`);
  let file = (await up.json()).file;
  for (let i = 0; i < 40 && file?.state === "PROCESSING"; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    file = await (await fetch(`${GEMINI_BASE}/v1beta/${file.name}`, { headers: { "x-goog-api-key": key } })).json();
  }
  if (file?.state === "FAILED") throw new Error("processing failed");
  return { fileData: { mimeType: file.mimeType ?? mime, fileUri: file.uri } };
}

async function fileParts(ctx: Ctx, key: string, f: FileRef, budget: { inline: number }): Promise<any[]> {
  const header = { text: `[File: ${f.name} (${f.mime}, ${Math.round(f.size / 1024)} KB)]` };
  try {
    const { data, error } = await ctx.db.storage.from(BUCKET).download(f.path);
    if (error || !data) return [{ text: `${header.text} could not be opened.` }];
    const bytes = new Uint8Array(await data.arrayBuffer());
    const mime = (f.mime || data.type || "").toLowerCase();

    if (TEXTISH.test(mime) || /\.(csv|txt|md|json|tsv|log)$/i.test(f.name)) {
      return [header, { text: new TextDecoder().decode(bytes).slice(0, 200_000) }];
    }
    if (SHEET.test(mime) || /\.(xlsx|xls|ods)$/i.test(f.name)) {
      const XLSX: any = await import("npm:xlsx@0.18.5");
      const wb = XLSX.read(bytes, { type: "array" });
      const text = wb.SheetNames.slice(0, 10).map((n: string) => `--- Sheet: ${n} ---\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join("\n");
      return [header, { text: text.slice(0, 200_000) }];
    }
    if (DOCX.test(mime) || /\.docx$/i.test(f.name)) {
      const mammoth: any = await import("npm:mammoth@1.8.0");
      const { Buffer } = await import("node:buffer");
      const out = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      return [header, { text: String(out.value).slice(0, 200_000) }];
    }
    const visual = IMAGE.test(mime) || mime === "application/pdf";
    const media = /^(video|audio)\//.test(mime);
    if (!visual && !media) return [{ text: `${header.text} This file type can't be read. Ask for a PDF, image, CSV, Excel or Word file instead.` }];
    if (visual && bytes.length <= INLINE_LIMIT && budget.inline + bytes.length <= 14 * 1024 * 1024) {
      budget.inline += bytes.length;
      return [header, { inlineData: { mimeType: mime.replace("image/jpg", "image/jpeg"), data: b64(bytes) } }];
    }
    return [header, await uploadToGemini(key, bytes, mime, f.name)];
  } catch (e) {
    console.error("file", f.name, e);
    return [{ text: `${header.text} could not be processed.` }];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini
// ─────────────────────────────────────────────────────────────────────────────
// Models that were overloaded or slow are skipped for a few minutes, so later
// messages don't wait on them again. (Lives as long as this function instance.)
const busyUntil = new Map<string, number>();
const BUSY_FOR_MS = 3 * 60_000;
const noThinkingLevel = new Set<string>();
const busyModels = {
  has: (m: string) => (busyUntil.get(m) ?? 0) > Date.now(),
  add: (m: string) => { busyUntil.set(m, Date.now() + BUSY_FOR_MS); },
};

async function callGemini(key: string, body: any, deadline: number, stop?: AbortSignal): Promise<any> {
  // Try the chosen model first; if it is busy, slow, missing or failing, move straight on to the next one.
  const all = [MODEL, ...FALLBACK_MODELS.filter((m) => m !== MODEL)];
  const fresh = all.filter((m) => !busyModels.has(m));
  const models = fresh.length ? fresh : all; // if everything was busy recently, try them all again
  let lastStatus = 0;
  let lastMsg = "";
  for (const model of models) {
    const left = deadline - Date.now();
    if (left < 4000) break;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.min(CALL_TIMEOUT_MS, left - 2000));
    const onStop = () => ctrl.abort();
    stop?.addEventListener("abort", onStop);
    // Less "thinking" = much faster replies. Newer models use thinkingLevel, 2.5 models thinkingBudget.
    const thinking = /2\.5/.test(model) ? { thinkingBudget: 0 } : noThinkingLevel.has(model) ? null : { thinkingLevel: "low" };
    const payload = thinking ? { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: thinking } } : body;
    let res: Response;
    try {
      res = await fetch(`${GEMINI_BASE}/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      stop?.removeEventListener("abort", onStop);
      if (stop?.aborted) throw new UserError("Stopped.");
      lastStatus = 0;
      lastMsg = ctrl.signal.aborted ? "took too long" : String(e).slice(0, 120);
      console.error("gemini", model, "no answer:", lastMsg);
      busyModels.add(model);
      continue;
    }
    clearTimeout(timer);
    stop?.removeEventListener("abort", onStop);
    if (res.ok) { busyUntil.delete(model); return await res.json(); }
    const text = await res.text();
    let msg = text;
    try { msg = JSON.parse(text)?.error?.message ?? text; } catch { /* not JSON */ }
    lastStatus = res.status;
    lastMsg = String(msg).slice(0, 200);
    console.error("gemini", model, res.status, text.slice(0, 500));
    if (res.status === 400 && /API key/i.test(text)) throw new UserError("The AI key on the server is not valid. An administrator needs to update GEMINI_API_KEY.");
    if (res.status === 403) throw new UserError(`The AI key on the server was refused (${lastMsg}). An administrator needs to check GEMINI_API_KEY.`);
    if (res.status === 400 && /thinking/i.test(text) && !noThinkingLevel.has(model)) {
      // This model doesn't accept the speed setting: retry it once without.
      noThinkingLevel.add(model);
      return callGemini(key, body, deadline, stop);
    }
    if (res.status === 400) throw new UserError(`The AI couldn't handle that request: ${lastMsg}`);
    if (res.status === 404) busyUntil.set(model, Infinity); // this model doesn't exist for this key
    else busyModels.add(model); // 429 / 5xx: try the next model
  }
  if (lastStatus === 429) throw new UserError("The AI has hit its free usage limit for the moment. Please wait a minute and try again.");
  if (lastStatus === 503 || lastMsg === "took too long") throw new UserError("Google's AI is very busy right now and didn't answer in time. Please try again in a minute.");
  throw new UserError(`The AI service is having trouble right now (${lastStatus || "no answer"}: ${lastMsg || "unknown error"}). Please try again shortly.`);
}

function systemPrompt(ctx: Ctx, tools: Tool[]) {
  const staff = STAFF.includes(ctx.role);
  return `You are the SmartBudget AI agent, built into SmartBudget, an educational personal-finance web app (prices in Australian dollars).
Today is ${ctx.today}. You are talking to ${ctx.name || "the user"} (${ctx.email}), whose role is "${ctx.role}".

How you work:
- You can take real actions with your tools. When the person asks you to do something your tools can do, do it instead of explaining how. Chain several tools if needed.
- For greetings, small talk and general knowledge questions, just answer straight away without calling any tools.
- Never invent data, ids or results. Look things up with tools, and only say something was done if a tool reported it.
- Tools marked as needing approval do not run until the person presses Approve on the card shown under your reply. Say clearly that it is waiting for their approval; never say it is done.
- If something important is unclear (for example an amount you can't read on a receipt), ask one short question instead of guessing.
- Reply in clear, friendly, concise Markdown. Use short lists or small tables for several items. Don't repeat raw ids to the person.
- You can't browse the web, send emails (except password resets for staff), or reach other apps. Say so honestly if asked.
${staff ? `- This is a staff account. You can report on the platform and run the admin tasks your tools allow for the "${ctx.role}" role. You can never see individual people's transactions, budgets or goals, only totals. Staff accounts have no personal budget of their own here.`
    : `- You only ever see and change this person's own money records. You have no access to anyone else's data or to admin features.
- Categories they have (use these exact names; capitalisation in what the person types doesn't matter): ${(ctx.cats ?? []).map((c) => c.name).join(", ") || "Food & Dining, Transport, Housing, Shopping, Utilities, Other, Income"}.
- People type casually: lowercase, typos, slang and short forms are normal. Work out what they mean (e.g. "food" means Food & Dining, "uber 25" is a $25 Transport expense, "got paid 3k" is $3,000 income) instead of asking, unless it is genuinely unclear.
- Receipts and invoices: read the merchant, date, total (including tax) and choose the best category; record ONE expense per receipt unless the person asks for line items; attach the file with receipt_file. If the total or date can't be read, ask.
- Bank statements, spreadsheets or lists: add every transaction (several add_transactions calls if more than 50). Money in = income, money out = expense.
- Images of things that are not receipts: describe them and help as asked.
- Videos and audio: watch or listen and help as asked (for example, list purchases mentioned).
- General money questions are welcome. Give educational information, not personal financial advice; for big decisions suggest a licensed adviser. Keep this note short.`}
Available tools: ${tools.map((t) => t.name + (t.confirm ? " (needs approval)" : "")).join(", ")}.`;
}

function historyToContents(rows: any[]): any[] {
  const contents: any[] = [];
  for (const m of rows) {
    let text = m.content || "";
    const att = Array.isArray(m.attachments) ? m.attachments : [];
    if (att.length) text += `\n[Files attached: ${att.map((f: any) => f.name).join(", ")}]`;
    const acts = Array.isArray(m.actions) ? m.actions.filter((a: Action) => a.kind === "write" || a.status === "pending") : [];
    if (acts.length) {
      text += `\n[Actions: ${acts.map((a: Action) => `${a.label} -> ${a.status === "pending" ? "waiting for approval" : a.status}${a.detail ? ` (${a.detail})` : ""}`).join("; ")}]`;
    }
    text = text.trim();
    if (!text) continue;
    const role = m.role === "assistant" ? "model" : "user";
    const prev = contents[contents.length - 1];
    if (prev && prev.role === role) prev.parts.push({ text });
    else contents.push({ role, parts: [{ text }] });
  }
  while (contents.length && contents[0].role !== "user") contents.shift();
  return contents;
}

// ─────────────────────────────────────────────────────────────────────────────
// Request handling
// ─────────────────────────────────────────────────────────────────────────────
async function setup(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  const apikey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const url = Deno.env.get("SUPABASE_URL");
  if (!url || !token || !apikey) throw new UserError("Please sign in again.");
  const db = createClient(url, apikey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Check the sign-in and load the profile at the same time (the id from the token is
  // only trusted after getUser confirms it).
  let claimedId = "";
  try { claimedId = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub ?? ""; } catch { /* checked below */ }
  const [{ data: who, error }, { data: profile }] = await Promise.all([
    db.auth.getUser(token),
    isUuid(claimedId) ? db.from("users").select("id, name, email, role, status").eq("id", claimedId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (error || !who.user) throw new UserError("Your session has expired. Please sign in again.");
  if (profile && profile.id !== who.user.id) throw new UserError("Please sign in again.");
  if (!profile) throw new UserError("Your profile was not found.");
  if (profile.status !== "active") throw new UserError("This account is suspended.");
  return { db, userId: who.user.id, role: profile.role as Role, name: profile.name, email: profile.email };
}

async function handleSend(req: Request, body: any) {
  const t0 = Date.now();
  const deadline = t0 + TOTAL_BUDGET_MS;
  const timing: Record<string, number> = {};
  const mark = (k: string) => { timing[k] = Date.now() - t0; };
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new UserError("The AI agent isn't set up yet: an administrator needs to add GEMINI_API_KEY in Supabase.");
  const base = await setup(req);
  mark("signed_in");
  const ctx: Ctx = { ...base, origin: clean(req.headers.get("origin"), 200), today: todayIn(clean(body.timezone, 60)), files: [] };
  const staff = STAFF.includes(ctx.role);

  const message = clean(body.message, 8000);
  const attachments: FileRef[] = (Array.isArray(body.attachments) ? body.attachments : []).slice(0, MAX_FILES).map((f: any) => ({
    path: clean(f?.path, 300), name: clean(f?.name, 150) || "file", mime: clean(f?.mime, 100) || "application/octet-stream", size: Number(f?.size) || 0,
  }));
  if (attachments.some((f) => !f.path.startsWith(ctx.userId + "/") || f.path.includes(".."))) throw new UserError("One of the files does not belong to you.");
  if (!message && !attachments.length) throw new UserError("Type a message or add a file.");

  let conversationId: string | null = isUuid(body.conversation_id) ? body.conversation_id : null;
  // These lookups don't depend on each other, so run them together.
  const [settingRes, quotaRes, , convRes, pastRes] = await Promise.all([
    staff ? Promise.resolve({ data: null }) : ctx.db.from("app_settings").select("value").eq("key", "assistant_enabled").maybeSingle(),
    ctx.db.rpc("agent_take_quota"),
    staff ? Promise.resolve(null) : categoryList(ctx).catch(() => null),
    conversationId ? ctx.db.from("agent_conversations").select("id, title").eq("id", conversationId).maybeSingle() : Promise.resolve({ data: null }),
    conversationId
      ? ctx.db.from("agent_messages").select("role, content, attachments, actions, created_at").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(HISTORY)
      : Promise.resolve({ data: [] }),
  ]);
  mark("lookups");
  if (settingRes.data && (settingRes.data as any).value === false) throw new UserError("The AI agent has been switched off by an administrator for now.");
  if (quotaRes.error) dbError(quotaRes.error);
  const quota: any = quotaRes.data;
  if (!quota?.ok) throw new UserError(quota?.message ?? "AI limit reached.");

  let title = "";
  let past: any[] = [];
  if (conversationId && convRes.data) {
    title = (convRes.data as any).title;
    past = (pastRes.data as any[]) ?? [];
  } else {
    title = (message || attachments[0]?.name || "New chat").replace(/\s+/g, " ").slice(0, 60);
    // The browser may pick the new chat's id itself, so a chat that is stopped
    // early can still be found again.
    let ins = await ctx.db.from("agent_conversations").insert({ ...(conversationId ? { id: conversationId } : {}), user_id: ctx.userId, title }).select("id").single();
    if (ins.error && conversationId) ins = await ctx.db.from("agent_conversations").insert({ user_id: ctx.userId, title }).select("id").single();
    if (ins.error) dbError(ins.error);
    conversationId = ins.data.id;
  }
  const history = past.reverse();
  for (const m of history) for (const f of (m.attachments ?? []) as FileRef[]) if (f?.path?.startsWith(ctx.userId + "/")) ctx.files.push(f);
  ctx.files.push(...attachments);

  // Save the person's message straight away (in the background while the AI works),
  // so it is never lost.
  const userMsgSave = ctx.db.from("agent_messages")
    .insert({ conversation_id: conversationId, user_id: ctx.userId, role: "user", content: message, attachments })
    .select("id, role, content, attachments, actions, created_at").single();

  const contents = historyToContents(history);
  const budget = { inline: 0 };
  // Re-send the most recent earlier files (not videos) so follow-up questions about them work.
  if (!attachments.length) {
    const lastWithFiles = [...history].reverse().slice(0, 6).find((m) => m.role === "user" && (m.attachments ?? []).length);
    if (lastWithFiles && contents.length) {
      const target = [...contents].reverse().find((c) => c.role === "user");
      for (const f of (lastWithFiles.attachments as FileRef[]).slice(0, 4)) {
        if (/^(video|audio)\//.test(f.mime)) continue;
        target?.parts.push(...(await fileParts(ctx, key, f, budget)));
      }
    }
  }
  const nowParts: any[] = [];
  for (const f of attachments) nowParts.push(...(await fileParts(ctx, key, f, budget)));
  nowParts.push({ text: message || "Please look at the attached file(s) and help me with them." });
  const last = contents[contents.length - 1];
  if (last && last.role === "user") last.parts.push(...nowParts);
  else contents.push({ role: "user", parts: nowParts });

  const tools = toolsFor(ctx.role);
  const byName = new Map(tools.map((t) => [t.name, t]));
  const actions: Action[] = [];
  let reply = "";

  for (let step = 0; step < MAX_STEPS; step++) {
    if (req.signal.aborted) { reply = "*Stopped.* Anything already done before you pressed Stop is kept."; break; }
    mark(`ai_call_${step + 1}_start`);
    const res = await callGemini(key, {
      systemInstruction: { parts: [{ text: systemPrompt(ctx, tools) }] },
      contents,
      tools: [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, ...(t.parameters ? { parameters: t.parameters } : {}) })) }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    }, deadline, req.signal);
    const cand = res?.candidates?.[0];
    if (!cand) {
      reply = res?.promptFeedback?.blockReason ? "I can't help with that request." : "I didn't get an answer from the AI. Please try again.";
      break;
    }
    const parts: any[] = cand.content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall);
    const text = parts.filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text).join("").trim();
    if (!calls.length) {
      reply = text || (cand.finishReason === "SAFETY" ? "I can't help with that request." : "Done.");
      break;
    }
    contents.push({ role: "model", parts });
    const responses: any[] = [];
    for (const p of calls) {
      const { name: rawName, args: rawArgs = {}, id } = p.functionCall;
      const name = String(rawName ?? "");
      const args = normalizeArgs(rawArgs);
      const tool = byName.get(name);
      if (req.signal.aborted && tool && tool.kind === "write") {
        responses.push({ functionResponse: { name, response: { error: "The person pressed Stop, so this was not done." }, ...(id ? { id } : {}) } });
        continue;
      }
      let response: any;
      if (!tool) {
        response = { error: `Tool ${name} is not available for this account.` };
      } else if (tool.confirm) {
        try {
          const pv = await tool.preview!(ctx, args);
          actions.push({ id: uid(), tool: name, kind: "write", status: "pending", label: pv.label, items: pv.items, args });
          response = { status: "waiting_for_user_approval", summary: pv.label, note: "An Approve / Cancel card is shown under your reply. It has NOT happened yet." };
        } catch (e) {
          response = { error: e instanceof UserError ? e.message : "That couldn't be prepared." };
          if (!(e instanceof UserError)) console.error(name, e);
        }
      } else {
        try {
          const out = await tool.run(ctx, args);
          actions.push({ id: uid(), tool: name, kind: tool.kind, status: "done", label: out.label, items: out.items, page: out.page });
          response = out.result;
        } catch (e) {
          const msg = e instanceof UserError ? e.message : "Something went wrong running that step.";
          if (!(e instanceof UserError)) console.error(name, e);
          if (tool.kind === "write") actions.push({ id: uid(), tool: name, kind: "write", status: "failed", label: `Couldn't complete: ${name.replace(/_/g, " ")}`, detail: msg });
          response = { error: msg };
        }
      }
      responses.push({ functionResponse: { name, response: response && typeof response === "object" && !Array.isArray(response) ? response : { result: response }, ...(id ? { id } : {}) } });
    }
    contents.push({ role: "user", parts: responses });
    if (step === MAX_STEPS - 1) reply = text || "I've done what I could in one go. Tell me if you'd like me to continue.";
  }

  mark("ai_done");
  const { data: userMsg, error: umErr } = await userMsgSave;
  if (umErr) dbError(umErr);
  const [{ data: botMsg, error: bmErr }] = await Promise.all([
    ctx.db.from("agent_messages")
      .insert({ conversation_id: conversationId, user_id: ctx.userId, role: "assistant", content: reply.slice(0, 40000), actions })
      .select("id, role, content, attachments, actions, created_at").single(),
    ctx.db.from("agent_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId),
  ]);
  if (bmErr) dbError(bmErr);
  mark("saved");
  console.log("timing ms", JSON.stringify(timing));

  return json({ conversation: { id: conversationId, title }, messages: [userMsg, botMsg], changed: actions.some((a) => a.kind === "write" && a.status === "done") });
}

async function handleDecide(req: Request, body: any) {
  const base = await setup(req);
  const ctx: Ctx = { ...base, origin: clean(req.headers.get("origin"), 200), today: todayIn(clean(body.timezone, 60)), files: [] };
  if (!isUuid(body.message_id)) throw new UserError("Unknown message.");
  const { data: msg, error } = await ctx.db.from("agent_messages").select("id, conversation_id, actions").eq("id", body.message_id).maybeSingle();
  if (error) dbError(error);
  if (!msg) throw new UserError("That message was not found.");
  const actions: Action[] = Array.isArray(msg.actions) ? msg.actions : [];
  const act = actions.find((a) => a.id === body.action_id);
  if (!act) throw new UserError("That action was not found.");
  if (act.status !== "pending") throw new UserError("That action has already been handled.");

  if (body.approve !== true) {
    act.status = "cancelled";
    delete act.args;
  } else {
    const tool = toolsFor(ctx.role).find((t) => t.name === act.tool && t.confirm);
    if (!tool) throw new UserError("Your account can't do that.");
    try {
      // Check again in case things changed since the card was shown.
      const pv = await tool.preview!(ctx, act.args ?? {});
      const out = await tool.run(ctx, act.args ?? {});
      act.status = "done";
      act.label = out.label;
      act.items = out.items ?? pv.items;
      act.page = out.page;
    } catch (e) {
      act.status = "failed";
      act.detail = e instanceof UserError ? e.message : "Something went wrong.";
      if (!(e instanceof UserError)) console.error(act.tool, e);
    }
    delete act.args;
  }
  const { data: saved, error: upErr } = await ctx.db.from("agent_messages").update({ actions }).eq("id", msg.id)
    .select("id, role, content, attachments, actions, created_at").single();
  if (upErr) dbError(upErr);
  return json({ message: saved, changed: act.status === "done" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    if (body.op === "decide") return await handleDecide(req, body);
    if (body.op === "ping") return json({ ok: true, ai_configured: !!Deno.env.get("GEMINI_API_KEY") });
    return await handleSend(req, body);
  } catch (e) {
    if (e instanceof UserError) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: "Something went wrong on the server. Please try again." }, 500);
  }
});
