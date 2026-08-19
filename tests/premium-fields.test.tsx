import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AmountField, DateField } from "@/components/ui/premium";

/**
 * V2.5.4 — Garantit que le nouveau champ montant se comporte comme un input
 * numérique classique côté logique (le formulaire reçoit toujours un `number`),
 * tout en acceptant la virgule décimale française et en reflétant les mises à
 * jour externes (ex. boutons de fraction dans la sheet Paiement) sans jamais
 * écraser une saisie en cours.
 */
describe("AmountField", () => {
  it("affiche une valeur initiale non nulle formatée avec une virgule", () => {
    render(<AmountField value={1234.5} onChange={() => {}} />);
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("1234,5");
  });

  it("affiche un champ vide pour une valeur à zéro (jamais '0')", () => {
    render(<AmountField value={0} onChange={() => {}} placeholder="0,00" />);
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
    expect(screen.getByPlaceholderText("0,00")).toBeTruthy();
  });

  it("convertit la virgule décimale en nombre pour le formulaire", () => {
    let latest = 0;
    render(<AmountField value={0} onChange={(next) => { latest = next; }} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "12,5" } });
    expect(latest).toBe(12.5);
    // La virgule tapée par l'utilisateur reste affichée telle quelle pendant la saisie.
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("12,5");
  });

  it("ignore les caractères non numériques (protège contre une saisie invalide)", () => {
    let latest = 0;
    render(<AmountField value={0} onChange={(next) => { latest = next; }} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "12a,5€" } });
    expect(latest).toBe(12.5);
  });

  it("reflète une mise à jour externe de la valeur (ex. bouton de fraction) quand le champ n'est pas focus", () => {
    const { rerender } = render(<AmountField value={0} onChange={() => {}} />);
    rerender(<AmountField value={487.5} onChange={() => {}} />);
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("487,5");
  });

  it("n'écrase jamais une saisie en cours si la valeur externe change pendant que le champ est focus", () => {
    const { rerender } = render(<AmountField value={0} onChange={() => {}} />);
    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "9" } });
    // Une mise à jour externe survient pendant que l'utilisateur tape encore.
    rerender(<AmountField value={100} onChange={() => {}} />);
    expect((input as HTMLInputElement).value).toBe("9");
  });

  it("affiche le suffixe de devise fourni", () => {
    render(<AmountField value={10} onChange={() => {}} suffix="AED" />);
    expect(screen.getByText("AED")).toBeTruthy();
  });

  it("rend le champ compact avec une classe dédiée", () => {
    const { container } = render(<AmountField value={10} onChange={() => {}} size="compact" />);
    expect(container.querySelector(".amount-input-wrap.compact")).toBeTruthy();
  });
});

describe("DateField", () => {
  it("rend un input date natif avec la valeur fournie", () => {
    render(<DateField value="2026-08-19" onChange={() => {}} />);
    const input = screen.getByDisplayValue("2026-08-19") as HTMLInputElement;
    expect(input.type).toBe("date");
  });

  it("transmet la nouvelle valeur brute au changement", () => {
    let latest = "";
    render(<DateField value="2026-08-19" onChange={(next) => { latest = next; }} />);
    fireEvent.change(screen.getByDisplayValue("2026-08-19"), { target: { value: "2026-09-01" } });
    expect(latest).toBe("2026-09-01");
  });
});
