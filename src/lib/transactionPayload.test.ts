import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTransactionInsertFields, parseTransactionType } from "./transactionPayload.ts";

test("parseTransactionType keeps Income as income", () => {
  assert.equal(parseTransactionType("income"), "income");
  assert.equal(parseTransactionType("Income"), "income");
});

test("parseTransactionType keeps Expense as expense", () => {
  assert.equal(parseTransactionType("expense"), "expense");
  assert.equal(parseTransactionType("Expense"), "expense");
});

test("parseTransactionType does not treat booleans as types", () => {
  assert.throws(() => parseTransactionType(false));
  assert.throws(() => parseTransactionType(true));
});

test("income insert payload keeps type income for a positive amount", () => {
  const payload = buildTransactionInsertFields({
    userId: "11111111-1111-1111-1111-111111111111",
    date: "2026-10-13",
    description: "test",
    amount: 1000,
    selectedType: "income",
    recurring: false,
  });
  assert.equal(payload.type, "income");
  assert.equal(payload.amount, 1000);
  assert.equal(payload.recurring, false);
});

test("expense insert payload keeps type expense and does not use amount sign as type", () => {
  const payload = buildTransactionInsertFields({
    userId: "11111111-1111-1111-1111-111111111111",
    date: "2026-10-13",
    description: "groceries",
    amount: 1000,
    selectedType: "expense",
    recurring: false,
  });
  assert.equal(payload.type, "expense");
  assert.equal(payload.amount, 1000);
  assert.equal(payload.recurring, false);
});

test("selected income is not overwritten when amount is negative in UI state", () => {
  const payload = buildTransactionInsertFields({
    userId: "11111111-1111-1111-1111-111111111111",
    date: "2026-10-13",
    description: "test",
    amount: -1000,
    selectedType: "income",
    recurring: true,
  });
  assert.equal(payload.type, "income");
  assert.equal(payload.amount, 1000);
  assert.equal(payload.recurring, true);
});

test("category id is carried into the insert payload", () => {
  const payload = buildTransactionInsertFields({
    userId: "11111111-1111-1111-1111-111111111111",
    date: "2026-10-13",
    description: "lunch",
    amount: 12.5,
    selectedType: "expense",
    recurring: false,
    categoryId: "22222222-2222-2222-2222-222222222222",
  });
  assert.equal(payload.category_id, "22222222-2222-2222-2222-222222222222");
});

test("empty or whitespace description is rejected", () => {
  assert.throws(() => buildTransactionInsertFields({
    userId: "u", date: "2026-10-13", description: "   ", amount: 5, selectedType: "expense", recurring: false,
  }), /describe/i);
});

test("description over 200 characters is rejected", () => {
  assert.throws(() => buildTransactionInsertFields({
    userId: "u", date: "2026-10-13", description: "x".repeat(201), amount: 5, selectedType: "expense", recurring: false,
  }), /200/);
});

test("invalid calendar dates are rejected", () => {
  for (const date of ["2026-02-30", "13/10/2026", "", "2026-13-01"]) {
    assert.throws(() => buildTransactionInsertFields({
      userId: "u", date, description: "x", amount: 5, selectedType: "expense", recurring: false,
    }), /date/i, date);
  }
});

test("zero, non-numeric and huge amounts are rejected", () => {
  for (const amount of [0, Number.NaN, 1e12]) {
    assert.throws(() => buildTransactionInsertFields({
      userId: "u", date: "2026-10-13", description: "x", amount, selectedType: "expense", recurring: false,
    }), /amount|large/i);
  }
});

test("amounts are rounded to cents", () => {
  const payload = buildTransactionInsertFields({
    userId: "u", date: "2026-10-13", description: "x", amount: 10.005 + 0.0001, selectedType: "expense", recurring: false,
  });
  assert.equal(payload.amount, 10.01);
});
