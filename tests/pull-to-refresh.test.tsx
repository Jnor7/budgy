import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";

/**
 * `fireEvent.touchStart/touchMove/touchEnd` prend `touches` directement dans
 * les options de l'événement — pas besoin de mocker `Touch`/`TouchEvent`
 * globalement, jsdom accepte les objets `{ clientY }` bruts dans `touches`.
 */
const touchAt = (clientY: number) => ({ touches: [{ clientY }] });

function setScrollY(value: number) {
  Object.defineProperty(window, "scrollY", { value, configurable: true, writable: true });
}

describe("PullToRefresh", () => {
  beforeEach(() => {
    setScrollY(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("8. ne se declenche pas si la page n'est pas tout en haut (scrollY > 0)", async () => {
    setScrollY(200);
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(<PullToRefresh onRefresh={onRefresh}><div>Contenu</div></PullToRefresh>);
    const container = screen.getByText("Contenu").closest(".pull-to-refresh") as HTMLElement;

    fireEvent.touchStart(container, touchAt(50));
    fireEvent.touchMove(container, touchAt(220));
    fireEvent.touchEnd(container);

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("9. appelle onRefresh quand le tirage depasse le seuil, depuis le haut de page", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(<PullToRefresh onRefresh={onRefresh}><div>Contenu</div></PullToRefresh>);
    const container = screen.getByText("Contenu").closest(".pull-to-refresh") as HTMLElement;

    fireEvent.touchStart(container, touchAt(50));
    // Delta de 200px : largement au-dessus du seuil (~72px avant resistance).
    fireEvent.touchMove(container, touchAt(250));
    await act(async () => { fireEvent.touchEnd(container); });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("un petit tirage sous le seuil n'appelle pas onRefresh", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(<PullToRefresh onRefresh={onRefresh}><div>Contenu</div></PullToRefresh>);
    const container = screen.getByText("Contenu").closest(".pull-to-refresh") as HTMLElement;

    fireEvent.touchStart(container, touchAt(50));
    // Delta de 10px, tres en dessous du seuil.
    fireEvent.touchMove(container, touchAt(60));
    await act(async () => { fireEvent.touchEnd(container); });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("10. n'appelle pas onRefresh une seconde fois tant qu'un refresh est deja en cours", async () => {
    let resolveRefresh: (() => void) | undefined;
    const onRefresh = vi.fn(() => new Promise<void>((resolve) => { resolveRefresh = resolve; }));
    render(<PullToRefresh onRefresh={onRefresh}><div>Contenu</div></PullToRefresh>);
    const container = screen.getByText("Contenu").closest(".pull-to-refresh") as HTMLElement;

    // Premier tirage : declenche le refresh, qui reste en attente (promesse non resolue).
    fireEvent.touchStart(container, touchAt(50));
    fireEvent.touchMove(container, touchAt(250));
    await act(async () => { fireEvent.touchEnd(container); });
    expect(onRefresh).toHaveBeenCalledTimes(1);

    // Second tirage pendant que le premier refresh est toujours en cours.
    fireEvent.touchStart(container, touchAt(50));
    fireEvent.touchMove(container, touchAt(250));
    await act(async () => { fireEvent.touchEnd(container); });
    expect(onRefresh).toHaveBeenCalledTimes(1);

    await act(async () => { resolveRefresh?.(); });

    // Une fois le premier refresh termine, un nouveau tirage redevient possible.
    fireEvent.touchStart(container, touchAt(50));
    fireEvent.touchMove(container, touchAt(250));
    await act(async () => { fireEvent.touchEnd(container); });
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it("ne se declenche pas si le doigt remonte (delta negatif)", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(<PullToRefresh onRefresh={onRefresh}><div>Contenu</div></PullToRefresh>);
    const container = screen.getByText("Contenu").closest(".pull-to-refresh") as HTMLElement;

    fireEvent.touchStart(container, touchAt(200));
    fireEvent.touchMove(container, touchAt(50));
    await act(async () => { fireEvent.touchEnd(container); });

    expect(onRefresh).not.toHaveBeenCalled();
  });
});
