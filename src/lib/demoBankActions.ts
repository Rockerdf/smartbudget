import { deleteTransaction, fetchTransactions, insertTransaction } from "./transactions";
import { demoSampleTransactions, isDemoTransaction, planDemoImport, planDemoRemoval } from "./demoBank";

export async function importDemoTransactions(): Promise<{ imported: number; skipped: number }> {
  const existing = await fetchTransactions();
  const samples = demoSampleTransactions();
  const { toInsert, alreadyPresent } = planDemoImport(existing, samples);

  let imported = 0;
  const failures: string[] = [];
  for (const tx of toInsert) {
    try {
      await insertTransaction(tx);
      imported += 1;
    } catch (err) {
      failures.push(err instanceof Error ? err.message : "Insert failed");
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Imported ${imported} of ${toInsert.length} missing demo transactions. ${failures[0]}`,
    );
  }

  return { imported, skipped: alreadyPresent.length };
}

export async function removeDemoTransactions(): Promise<number> {
  const existing = await fetchTransactions();
  const demoRows = planDemoRemoval(existing).filter((tx) => tx.id && isDemoTransaction(tx));

  let removed = 0;
  const failures: string[] = [];
  for (const tx of demoRows) {
    try {
      await deleteTransaction(tx.id);
      removed += 1;
    } catch (err) {
      failures.push(err instanceof Error ? err.message : "Delete failed");
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Removed ${removed} of ${demoRows.length} demo transactions. ${failures[0]}`,
    );
  }

  return removed;
}
