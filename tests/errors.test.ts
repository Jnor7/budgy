import { describe, expect, it } from "vitest";
import { describeSupabaseError } from "@/lib/errors";

describe("describeSupabaseError", () => {
  it("combine message et hint pour une PostgrestError, comme recommandé par Supabase", () => {
    const error = { message: "No API key found in request", hint: "No `apikey` request header or url param was found.", code: "PGRST000" };
    expect(describeSupabaseError(error)).toBe(
      "No API key found in request — No `apikey` request header or url param was found. — (code PGRST000)",
    );
  });

  it("n'ajoute pas le hint s'il est identique au message", () => {
    const error = { message: "Erreur", hint: "Erreur" };
    expect(describeSupabaseError(error)).toBe("Erreur");
  });

  it("gère une Error native standard (juste .message)", () => {
    expect(describeSupabaseError(new Error("Session expirée."))).toBe("Session expirée.");
  });

  it("retombe sur le fallback pour une valeur sans information exploitable", () => {
    expect(describeSupabaseError({}, "Import impossible.")).toBe("Import impossible.");
    expect(describeSupabaseError(null, "Import impossible.")).toBe("Import impossible.");
    expect(describeSupabaseError(undefined, "Import impossible.")).toBe("Import impossible.");
  });

  it("accepte une simple chaîne comme erreur", () => {
    expect(describeSupabaseError("Erreur réseau")).toBe("Erreur réseau");
  });

  it("fonctionne par duck-typing même sans instanceof Error (deux copies du module Supabase)", () => {
    // Simule une erreur qui NE PASSE PAS `instanceof Error` (ex. objet simple
    // renvoyé par un mock, ou classe dupliquée dans l'arbre de dépendances).
    const duckTyped = { message: "RLS a bloqué la requête", hint: "Vérifiez vos policies", code: "42501" };
    expect(duckTyped).not.toBeInstanceOf(Error);
    expect(describeSupabaseError(duckTyped)).toContain("RLS a bloqué la requête");
    expect(describeSupabaseError(duckTyped)).toContain("Vérifiez vos policies");
  });
});
