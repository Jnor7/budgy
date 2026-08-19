import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { WalletCards } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormModal } from "@/components/ui/modal";
import { AmountField } from "@/components/ui/premium";
import { safeCurrency } from "@/lib/domain/dubai";
import { money } from "@/lib/format";

describe("V2.5.7 — fiabilité des formulaires popup", () => {
  afterEach(() => vi.useRealTimers());

  it("demande confirmation avant de fermer un formulaire modifié", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<FormModal open title="Nouvelle transaction" icon={WalletCards} onClose={onClose} onSubmit={() => {}}><label>Intitulé<input /></label></FormModal>);

    fireEvent.change(screen.getByLabelText("Intitulé"), { target: { value: "Taxi" } });
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

    expect(screen.getByRole("alertdialog", { name: /Quitter ce formulaire/ })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Continuer la saisie" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    fireEvent.click(screen.getByRole("button", { name: "Quitter sans enregistrer" }));
    act(() => vi.advanceTimersByTime(180));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("ferme directement quand le formulaire est intact", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<FormModal open title="Nouveau voyage" icon={WalletCards} onClose={onClose} onSubmit={() => {}}><input /></FormModal>);
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    act(() => vi.advanceTimersByTime(180));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("n'active jamais automatiquement un champ montant", () => {
    render(<FormModal open title="Paiement" icon={WalletCards} onClose={() => {}} onSubmit={() => {}}><AmountField value={0} onChange={() => {}} autoFocus /></FormModal>);
    expect(document.activeElement?.tagName).not.toBe("INPUT");
  });
});

describe("V2.5.7 — sécurité Budget et robustesse Dubaï", () => {
  it("fait passer la copie mensuelle par un dialogue de confirmation", () => {
    const source = readFileSync(path.join(process.cwd(), "app/(app)/budget/page.tsx"), "utf8");
    expect(source).toContain("setCopyConfirm(true)");
    expect(source).toContain('confirmLabel="Copier le budget"');
    expect(source).not.toContain('action === "copy") copyNext()');
  });

  it("normalise les préférences de devise Dubaï anciennes ou invalides", () => {
    expect(safeCurrency("FCFA")).toBe("FCFA");
    expect(safeCurrency("CFA")).toBe("FCFA");
    expect(safeCurrency("ancienne-valeur")).toBe("AED");
    expect(safeCurrency(null)).toBe("AED");
  });

  it("formate le FCFA sans exception Intl", () => {
    expect(() => money(125000, "FCFA")).not.toThrow();
    expect(money(125000, "FCFA")).toMatch(/125[\s\u202f]?000|125000/);
  });
});
