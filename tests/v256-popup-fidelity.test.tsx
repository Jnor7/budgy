import { act, fireEvent, render, screen } from "@testing-library/react";
import { WalletCards } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormModal } from "@/components/ui/modal";

const renderModal = (options: { onClose?: () => void; onSubmit?: () => void; disabled?: boolean } = {}) => render(
  <FormModal
    open title="Nouvelle transaction" icon={WalletCards} tone="red"
    submitLabel="Enregistrer la transaction" disableSubmit={options.disabled}
    onClose={options.onClose ?? (() => {})} onSubmit={options.onSubmit ?? (() => {})}
  >
    <label>Intitulé<input /></label>
  </FormModal>,
);

describe("V2.5.6 — FormModal flottante", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.style.overflow = "";
  });

  it("sépare overlay, fenêtre, zone scrollable et CTA fixe", () => {
    renderModal();
    expect(screen.getByRole("dialog", { name: "Nouvelle transaction" }).classList.contains("form-modal")).toBe(true);
    expect(document.querySelector(".form-modal-backdrop")).toBeTruthy();
    expect(document.querySelector(".form-modal-scroll")).toBeTruthy();
    const footer = document.querySelector(".form-modal-footer");
    expect(footer?.contains(screen.getByRole("button", { name: "Enregistrer la transaction" }))).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("ferme avec Échap après l’animation inverse", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.querySelector(".form-modal")?.classList.contains("is-closing")).toBe(true);
    act(() => vi.advanceTimersByTime(180));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("ferme par le bouton X et par le fond, sans déclencher la soumission", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    const { unmount } = renderModal({ onClose, onSubmit });
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    act(() => vi.advanceTimersByTime(180));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
    unmount();

    renderModal({ onClose, onSubmit });
    fireEvent.mouseDown(document.querySelector(".form-modal-backdrop") as HTMLElement);
    act(() => vi.advanceTimersByTime(180));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("respecte l’état désactivé puis soumet après l’animation", () => {
    const disabled = renderModal({ disabled: true });
    expect((screen.getByRole("button", { name: "Enregistrer la transaction" }) as HTMLButtonElement).disabled).toBe(true);
    disabled.unmount();

    vi.useFakeTimers();
    const onSubmit = vi.fn();
    renderModal({ onSubmit });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la transaction" }));
    act(() => vi.advanceTimersByTime(180));
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
