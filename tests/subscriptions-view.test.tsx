import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SubscriptionsPage from "@/app/(app)/subscriptions/page";
import type { AppData, Subscription } from "@/types/domain";

const item: Subscription = { id: "sub-1", userId: "user-1", title: "Apple Music", amount: 5.99, dueDay: 5, category: "Abonnement", systemImage: "music", colorHex: "#ef476f", scope: "Perso", isActive: true, note: "", lifecycleStatus: "ACTIVE", frequency: "MONTHLY" };
const data = { subscriptions: [item] } as AppData;
vi.mock("@/lib/data/data-provider", () => ({ useBudgyData: () => ({ data, create: vi.fn(), update: vi.fn(), remove: vi.fn() }) }));

describe("SubscriptionsPage", () => {
  it("bascule de la liste vers le calendrier sans changer de source de données", () => {
    render(<SubscriptionsPage />);
    expect(screen.getByText("Mes abonnements")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Calendrier" }));
    expect(screen.getByRole("tab", { name: "Calendrier" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir Apple Music" }));
    expect(screen.getByText("Modifier l’abonnement")).toBeTruthy();
  });
});
