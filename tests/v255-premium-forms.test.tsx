import { render, screen } from "@testing-library/react";
import { Banknote } from "lucide-react";
import { describe, expect, it } from "vitest";
import { Sheet } from "@/components/ui/modal";
import { V2Donut } from "@/components/ui/v2";

/**
 * V2.5.5 — Le CTA principal d'une sheet doit toujours vivre dans un pied de
 * page fixé en bas (`.sheet-footer`), jamais dans le header. C'est le
 * changement structurel qui garantit "un gros CTA fixe en bas" sur tous les
 * formulaires de l'application sans avoir à toucher chaque écran.
 */
describe("Sheet — CTA fixe en bas et icône illustrative", () => {
  it("rend le bouton de soumission dans le pied de page, pas dans le header", () => {
    render(
      <Sheet open title="Nouvelle transaction" submitLabel="Ajouter" onSubmit={() => {}} onClose={() => {}}>
        <p>Contenu</p>
      </Sheet>,
    );
    const footer = document.querySelector(".sheet-footer");
    expect(footer).toBeTruthy();
    const submitButton = screen.getByRole("button", { name: "Ajouter" });
    expect(footer?.contains(submitButton)).toBe(true);

    const header = document.querySelector(".sheet-header");
    expect(header?.contains(submitButton)).toBe(false);
  });

  it("ne rend aucun pied de page quand aucune action de soumission n'est fournie (sheet d'affichage)", () => {
    render(
      <Sheet open title="Documents" onClose={() => {}}>
        <p>Contenu</p>
      </Sheet>,
    );
    expect(document.querySelector(".sheet-footer")).toBeNull();
  });

  it("le bouton Annuler reste discret dans le header, distinct du CTA principal", () => {
    render(
      <Sheet open title="Ajouter une dette" submitLabel="Ajouter" onSubmit={() => {}} onClose={() => {}}>
        <p>Contenu</p>
      </Sheet>,
    );
    const cancelButton = screen.getByRole("button", { name: "Annuler" });
    const header = document.querySelector(".sheet-header");
    expect(header?.contains(cancelButton)).toBe(true);
  });

  it("affiche une icône illustrative quand elle est fournie", () => {
    render(
      <Sheet open title="Paiement" onSubmit={() => {}} onClose={() => {}} icon={Banknote} tone="cyan">
        <p>Contenu</p>
      </Sheet>,
    );
    expect(document.querySelector(".sheet-icon-badge")).toBeTruthy();
  });

  it("n'affiche aucun badge d'icône quand aucune icône n'est fournie", () => {
    render(
      <Sheet open title="Sans icône" onSubmit={() => {}} onClose={() => {}}>
        <p>Contenu</p>
      </Sheet>,
    );
    expect(document.querySelector(".sheet-icon-badge")).toBeNull();
  });

  it("désactive bien le CTA du pied de page quand disableSubmit est vrai", () => {
    render(
      <Sheet open title="Nouvelle transaction" submitLabel="Ajouter" onSubmit={() => {}} onClose={() => {}} disableSubmit>
        <p>Contenu</p>
      </Sheet>,
    );
    expect((screen.getByRole("button", { name: "Ajouter" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

/**
 * V2.5.5 — La part "Fixes" du donut Budget doit utiliser le même dégradé bleu
 * que la carte principale et la barre de progression, jamais un violet plat.
 */
describe("V2Donut — dégradé bleu pour la part Fixes", () => {
  it("applique un dégradé (url(#...)) à la part Fixes plutôt qu'une couleur plate", () => {
    const { container } = render(
      <V2Donut
        slices={[
          { label: "Fixes", amount: 700, share: 0.7 },
          { label: "Variables", amount: 300, share: 0.3 },
        ]}
        centerValue="1 000 €"
      />,
    );
    const circles = container.querySelectorAll("circle");
    // Le premier cercle est le rail de fond ; les parts suivent dans l'ordre des slices.
    const fixesArc = circles[1];
    const variablesArc = circles[2];
    expect(fixesArc?.getAttribute("stroke")).toMatch(/^url\(#.+\)$/);
    expect(variablesArc?.getAttribute("stroke")).not.toMatch(/^url\(/);

    const gradient = container.querySelector("linearGradient");
    expect(gradient).toBeTruthy();
  });

  it("reconnaît 'Fixes' indépendamment de la casse et des espaces", () => {
    const { container } = render(
      <V2Donut slices={[{ label: "  fixes  ", amount: 100, share: 1 }]} centerValue="100 €" />,
    );
    const arc = container.querySelectorAll("circle")[1];
    expect(arc?.getAttribute("stroke")).toMatch(/^url\(#.+\)$/);
  });

  it("n'applique aucun dégradé aux autres catégories (Loyers, Voyages, etc.)", () => {
    const { container } = render(
      <V2Donut slices={[{ label: "Loyers", amount: 100, share: 1 }]} centerValue="100 €" />,
    );
    const arc = container.querySelectorAll("circle")[1];
    expect(arc?.getAttribute("stroke")).not.toMatch(/^url\(/);
  });
});
