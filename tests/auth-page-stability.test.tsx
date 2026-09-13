import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/feedback";
import AuthPage from "@/app/auth/page";

const mocked = vi.hoisted(() => ({ signIn: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocked.replace, refresh: mocked.refresh }) }));
vi.mock("@/services/auth", () => ({
  signIn: mocked.signIn,
  signUp: vi.fn(), requestPasswordReset: vi.fn(),
  resolvePostSignup: () => "onboarding",
}));

describe("écran Neon Auth", () => {
  beforeEach(() => mocked.signIn.mockReset());

  it("réactive le bouton et affiche l'erreur si le login lève une exception", async () => {
    mocked.signIn.mockResolvedValue({ data: null, error: new Error("Réseau indisponible") });
    render(<ToastProvider><AuthPage /></ToastProvider>);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "password123" } });
    const button = screen.getByRole("button", { name: "Se connecter" });
    fireEvent.click(button);
    await screen.findByText("Réseau indisponible");
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  });
});
