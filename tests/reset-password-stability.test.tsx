import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResetPasswordPage from "@/app/auth/reset-password/page";

const mocked = vi.hoisted(() => ({ resetPassword: vi.fn() }));
vi.mock("@/lib/auth/client", () => ({ authClient: { resetPassword: mocked.resetPassword } }));

describe("reset password Neon", () => {
  beforeEach(() => mocked.resetPassword.mockReset());

  it("transmet le token de l'URL à Neon Auth", async () => {
    window.history.replaceState({}, "", "/auth/reset-password?token=valid-token");
    mocked.resetPassword.mockResolvedValue({ data: {}, error: null });
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText("Nouveau mot de passe"), { target: { value: "nouveau-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(mocked.resetPassword).toHaveBeenCalledWith({ newPassword: "nouveau-secret", token: "valid-token" }));
    await screen.findByText(/Mot de passe mis à jour/);
  });

  it("refuse un lien sans token sans appeler Neon Auth", async () => {
    window.history.replaceState({}, "", "/auth/reset-password");
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText("Nouveau mot de passe"), { target: { value: "nouveau-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await screen.findByText(/Token de réinitialisation absent/);
    expect(mocked.resetPassword).not.toHaveBeenCalled();
  });
});
