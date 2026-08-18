import { describe, expect, it } from "vitest";
import { resolveMigrationAvailability } from "@/lib/data/migration-state";

describe("resolveMigrationAvailability", () => {
  it("Cas 1 — mode local : import distant indisponible", () => {
    const result = resolveMigrationAvailability({ localMode: true, ready: true, repositoryReady: false });
    expect(result).toBe("local");
  });

  it("Cas 1bis — mode local même si ready/repositoryReady sont incohérents (localMode gagne toujours)", () => {
    const result = resolveMigrationAvailability({ localMode: true, ready: false, repositoryReady: true });
    expect(result).toBe("local");
  });

  it("Cas 2 — Supabase configuré, session présente, repository prêt : import disponible", () => {
    const result = resolveMigrationAvailability({ localMode: false, ready: true, repositoryReady: true });
    expect(result).toBe("ready");
  });

  it("Cas 3 — Supabase configuré mais session absente : message de connexion", () => {
    const result = resolveMigrationAvailability({ localMode: false, ready: true, repositoryReady: false });
    expect(result).toBe("signed-out");
  });

  it("Cas 4 — Supabase configuré, repository en cours d'initialisation : état loading", () => {
    const result = resolveMigrationAvailability({ localMode: false, ready: false, repositoryReady: false });
    expect(result).toBe("connecting");
  });

  it("ne confond jamais 'configuré' et 'prêt' : repositoryReady=true sans ready ne suffit pas (transition impossible en pratique, mais ready prime)", () => {
    // Ce cas ne devrait jamais se produire en pratique (repositoryReady ne passe à
    // true qu'après ready), mais on vérifie que la fonction reste défensive : elle ne
    // déclare jamais "ready" avant que le premier essai (`ready`) ne soit terminé.
    const result = resolveMigrationAvailability({ localMode: false, ready: false, repositoryReady: true });
    expect(result).toBe("connecting");
  });

  it("chaque message de disponibilité non-ready est non vide et distinct", () => {
    const local = resolveMigrationAvailability({ localMode: true, ready: true, repositoryReady: false });
    const connecting = resolveMigrationAvailability({ localMode: false, ready: false, repositoryReady: false });
    const signedOut = resolveMigrationAvailability({ localMode: false, ready: true, repositoryReady: false });
    expect(new Set([local, connecting, signedOut]).size).toBe(3);
  });
});
