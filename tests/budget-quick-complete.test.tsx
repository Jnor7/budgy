import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BudgetQuickComplete } from "@/components/budget/budget-quick-complete";
import type { BudgetEntry } from "@/types/domain";

const entry = (patch: Partial<BudgetEntry> = {}): BudgetEntry => ({
  id: "entry-1", userId: "user-1", title: "Salaire", amount: 100, potentialAmount: 0,
  type: "revenu", category: "Salaire", bucket: "Rentrées", scope: "Perso",
  date: "2027-01-05", note: "", status: "non", ...patch,
});

describe("BudgetQuickComplete", () => {
  it("valide une entrée en un clic avec le libellé Reçu", () => {
    const onComplete = vi.fn();
    const item = entry();
    render(<BudgetQuickComplete entry={item} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole("button", { name: "Marquer Salaire reçu" }));
    expect(onComplete).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledWith(item);
  });

  it("affiche Payé pour une dépense et ne la retraite pas si elle est déjà passée", () => {
    const onComplete = vi.fn();
    render(<BudgetQuickComplete entry={entry({ title: "Loyer", type: "depense", status: "recu" })} onComplete={onComplete} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByLabelText("Loyer : payé")).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
