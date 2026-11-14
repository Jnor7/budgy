"use client";

import { Check } from "lucide-react";
import type { BudgetEntry } from "@/types/domain";

export function BudgetQuickComplete({
  entry,
  onComplete,
}: {
  entry: BudgetEntry;
  onComplete: (entry: BudgetEntry) => void;
}) {
  const label = entry.type === "revenu" ? "Reçu" : "Payé";
  const done = entry.status === "recu";

  if (done) {
    return (
      <span className="budget-quick-complete is-done" aria-label={`${entry.title} : ${label.toLowerCase()}`}>
        <Check size={14} aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      className="budget-quick-complete"
      aria-label={`Marquer ${entry.title} ${label.toLowerCase()}`}
      onClick={() => onComplete(entry)}
    >
      <Check size={14} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
