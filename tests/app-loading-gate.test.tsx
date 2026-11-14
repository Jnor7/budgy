import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppLoadingGate, appLoadingTiming } from "@/components/app-loading-gate";

const state = vi.hoisted(() => ({ ready: false }));
vi.mock("@/lib/data/data-provider", () => ({ useBudgyData: () => ({ ready: state.ready }) }));

describe("AppLoadingGate", () => {
  beforeEach(() => { vi.useFakeTimers(); state.ready = false; });
  afterEach(() => vi.useRealTimers());

  it("ne clignote pas quand les données sont disponibles immédiatement", () => {
    const view = render(<AppLoadingGate><p>Contenu</p></AppLoadingGate>);
    state.ready = true; view.rerender(<AppLoadingGate><p>Contenu</p></AppLoadingGate>);
    act(() => vi.advanceTimersByTime(appLoadingTiming.showDelay + 20));
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("Contenu")).toBeTruthy();
  });

  it("affiche un écran discret pour une initialisation lente puis le retire en douceur", () => {
    const view = render(<AppLoadingGate><p>Contenu</p></AppLoadingGate>);
    act(() => vi.advanceTimersByTime(appLoadingTiming.showDelay));
    expect(screen.getByRole("status")).toBeTruthy();
    state.ready = true; view.rerender(<AppLoadingGate><p>Contenu</p></AppLoadingGate>);
    act(() => vi.advanceTimersByTime(appLoadingTiming.minimumVisible + appLoadingTiming.exitDuration));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
