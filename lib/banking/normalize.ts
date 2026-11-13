import "server-only";

import { createHash } from "node:crypto";
import type { BankAccountDetails, BankBalance, BankTransaction } from "./provider";

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export function suggestCategory(description: string) {
  if (/\b(netflix|spotify)\b/i.test(description)) return "Abonnements";
  if (/\b(carrefour|auchan)\b/i.test(description)) return "Courses";
  if (/\b(uber|sncf)\b/i.test(description)) return "Transport";
  if (/\bsalaire\b/i.test(description)) return "Revenus";
  return null;
}

const normalizedText = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
const normalizedAmount = (value: string) => value.replace(/^(-?)0+(?=\d)/, "$1").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "").replace(/^-0$/, "0");

export function normalizeTransactions(accountId: string, items: BankTransaction[]) {
  const result = new Map<string, BankTransaction & { key: string }>();
  const occurrences = new Map<string, number>();
  for (const item of items) {
    const fingerprint = digest(JSON.stringify([
      accountId, item.bookingDate ?? item.valueDate, normalizedAmount(item.amount), item.currency,
      normalizedText(item.description || item.counterparty || ""), normalizedText(item.reference ?? ""),
    ]));
    const occurrenceKey = `${item.status}:${fingerprint}`;
    const occurrence = occurrences.get(occurrenceKey) ?? 0;
    if (!item.providerId) occurrences.set(occurrenceKey, occurrence + 1);
    const key = item.providerId ? `id:${item.providerId}` : `fp:${fingerprint}:${occurrence}`;
    if (result.get(key)?.status !== "booked") result.set(key, { ...item, key });
  }
  return [...result.values()];
}

export function splitAccount(details: BankAccountDetails, balances: BankBalance[], transactions: BankTransaction[]) {
  const currencies = new Set(balances.map((balance) => balance.currency));
  if (details.currency) currencies.add(details.currency);
  for (const transaction of transactions) {
    if (!transaction.deleted) currencies.add(transaction.currency);
  }
  const sorted = [...balances].sort((a, b) => b.date.localeCompare(a.date) || b.priority - a.priority);
  const identity = details.resourceId ? `resource:${details.resourceId}` : details.iban ? `iban:${details.iban}` : null;
  return [...currencies].map((currency) => ({
    currency, identity: identity ? digest(identity) : null,
    displayName: currencies.size > 1 ? `${details.name} · ${currency}` : details.name,
    currentBalance: sorted.find((item) => item.currency === currency && item.type === "current")?.amount ?? null,
    availableBalance: sorted.find((item) => item.currency === currency && item.type === "available")?.amount ?? null,
    transactions: transactions.filter((item) => item.currency === currency),
  }));
}
