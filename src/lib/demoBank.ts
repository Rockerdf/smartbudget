/**
 * Simulated bank connection for the SmartBudget prototype.
 * Not a real bank, aggregator, or credential store.
 */

export type DemoSampleTransaction = {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  type: "income" | "expense";
  recurring: boolean;
  note: string;
};

export type DemoBankAccount = {
  id: string;
  bank: string;
  name: string;
  last4: string;
  type: "checking" | "savings";
  sampleBalance: number;
  demo: true;
};

/** Stored in `transactions.note` so demo rows can be found without a schema change. */
export const DEMO_NOTE_MARKER = "sb-demo-bank:v1";

export function demoNoteForSample(sampleId: string): string {
  return `${DEMO_NOTE_MARKER}:${sampleId}`;
}

/** Sample id from `sb-demo-bank:v1:<id>`. Legacy notes that are only the marker return null. */
export function demoSampleIdFromNote(note?: string | null): string | null {
  const value = (note ?? "").trim();
  if (!value.includes(DEMO_NOTE_MARKER)) return null;
  const prefix = `${DEMO_NOTE_MARKER}:`;
  if (!value.startsWith(prefix)) return null;
  const id = value.slice(prefix.length).trim().split(/\s+/)[0] ?? "";
  return id || null;
}

export const DEMO_ACCOUNT: DemoBankAccount = {
  id: "demo-harbour-everyday",
  bank: "Harbour Demo Bank",
  name: "Demo Everyday Account",
  last4: "4242",
  type: "checking",
  sampleBalance: 2450.75,
  demo: true,
};

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isDemoTransaction(tx: { note?: string | null; description?: string }): boolean {
  return (tx.note ?? "").includes(DEMO_NOTE_MARKER);
}

export function existingCoversSample(
  existing: Array<{ note?: string | null; description?: string }>,
  sample: Pick<DemoSampleTransaction, "id" | "description">,
): boolean {
  return existing.some((row) => {
    if (!isDemoTransaction(row)) return false;
    const id = demoSampleIdFromNote(row.note);
    if (id) return id === sample.id;
    return (row.description ?? "") === sample.description;
  });
}

export function planDemoImport(
  existing: Array<{ note?: string | null; description?: string }>,
  samples: DemoSampleTransaction[] = demoSampleTransactions(),
) {
  const toInsert: DemoSampleTransaction[] = [];
  const alreadyPresent: DemoSampleTransaction[] = [];
  for (const sample of samples) {
    if (existingCoversSample(existing, sample)) alreadyPresent.push(sample);
    else toInsert.push(sample);
  }
  return { toInsert, alreadyPresent };
}

export function planDemoRemoval<T extends { note?: string | null }>(existing: T[]): T[] {
  return existing.filter(isDemoTransaction);
}

export function demoSampleTransactions(): DemoSampleTransaction[] {
  const specs: Array<Omit<DemoSampleTransaction, "date" | "note">> = [
    { id: "salary", description: "[Demo] Salary", category: "Income", amount: 3200, type: "income", recurring: false },
    { id: "rent", description: "[Demo] Rent", category: "Housing", amount: 1450, type: "expense", recurring: false },
    { id: "groceries", description: "[Demo] Groceries", category: "Food & Dining", amount: 86.4, type: "expense", recurring: false },
    { id: "transport", description: "[Demo] Transport", category: "Transport", amount: 22.5, type: "expense", recurring: false },
    { id: "coffee", description: "[Demo] Coffee", category: "Food & Dining", amount: 5.8, type: "expense", recurring: false },
  ];
  const daysAgo = [12, 10, 4, 2, 1];
  return specs.map((spec, i) => ({
    ...spec,
    date: isoDaysAgo(daysAgo[i] ?? 1),
    note: demoNoteForSample(spec.id),
  }));
}

function storageKey(userId: string) {
  return `sb_demo_bank:${userId}`;
}

export function loadDemoConnection(userId: string): DemoBankAccount | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string; demo?: boolean };
    if (parsed?.id !== DEMO_ACCOUNT.id || parsed.demo !== true) return null;
    return { ...DEMO_ACCOUNT };
  } catch {
    return null;
  }
}

export function saveDemoConnection(userId: string, connected: boolean) {
  if (!userId) return;
  if (connected) {
    localStorage.setItem(storageKey(userId), JSON.stringify(DEMO_ACCOUNT));
  } else {
    localStorage.removeItem(storageKey(userId));
  }
}
