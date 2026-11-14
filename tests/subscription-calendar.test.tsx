import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SubscriptionCalendar } from "@/components/subscriptions/subscription-calendar";
import { subscriptionDayForMonth } from "@/lib/domain/subscription-calendar";
import type { Subscription } from "@/types/domain";

const subscription = (patch: Partial<Subscription> = {}): Subscription => ({
  id: "sub-1", userId: "user-1", title: "ChatGPT", amount: 21.57, dueDay: 6,
  category: "Abonnement", systemImage: "creditcard.fill", colorHex: "#10a37f",
  scope: "Perso", isActive: true, note: "", frequency: "MONTHLY", lifecycleStatus: "ACTIVE",
  ...patch,
});

describe("SubscriptionCalendar", () => {
  it("place une échéance mensuelle et utilise un fallback quand le logo manque", () => {
    render(<SubscriptionCalendar subscriptions={[subscription()]} month={new Date(2027, 0, 1)} onMonthChange={() => {}} onSelect={() => {}} />);
    const item = screen.getByRole("button", { name: "Ouvrir ChatGPT" });
    expect(item).toBeTruthy();
    expect(item.querySelector('[data-logo="fallback"]')).toBeTruthy();
  });

  it("ouvre la fiche existante au clic et navigue entre les mois", () => {
    const onSelect = vi.fn();
    const onMonthChange = vi.fn();
    const item = subscription();
    render(<SubscriptionCalendar subscriptions={[item]} month={new Date(2027, 0, 1)} onMonthChange={onMonthChange} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir ChatGPT" }));
    expect(onSelect).toHaveBeenCalledWith(item);
    fireEvent.click(screen.getByRole("button", { name: "Mois précédent" }));
    fireEvent.click(screen.getByRole("button", { name: "Mois suivant" }));
    expect(onMonthChange.mock.calls[0]?.[0]).toEqual(new Date(2026, 11, 1));
    expect(onMonthChange.mock.calls[1]?.[0]).toEqual(new Date(2027, 1, 1));
  });

  it("n’invente pas de jour pour un abonnement sans date fiable", () => {
    const undated = subscription({ id: "api", title: "Anthropic API", amount: 0, dueDay: 1, lifecycleStatus: "API_CREDIT", nextExpectedPayment: null, expectedDate: null });
    expect(subscriptionDayForMonth(undated, new Date(2027, 0, 1))).toBeNull();
    render(<SubscriptionCalendar subscriptions={[undated]} month={new Date(2027, 0, 1)} onMonthChange={() => {}} onSelect={() => {}} />);
    expect(screen.getByText(/Sans date fiable : Anthropic API/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ouvrir Anthropic API" })).toBeNull();
  });
});
