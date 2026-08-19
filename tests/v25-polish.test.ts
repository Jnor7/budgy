import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePostSignup } from "@/services/auth";

describe("parcours V2.5", () => {
  it("enchaîne une inscription avec session vers l'onboarding", () => {
    expect(resolvePostSignup({ access_token: "session" })).toBe("onboarding");
  });

  it("affiche le repli e-mail lorsque Supabase ne crée pas de session", () => {
    expect(resolvePostSignup(null)).toBe("confirm-email");
  });

  it("ne propose plus de champ URL d'image dans le formulaire voyage", () => {
    const source = readFileSync(path.join(process.cwd(), "app/(app)/trips/page.tsx"), "utf8");
    expect(source).not.toContain("Image de destination (URL)");
    expect(source).not.toContain('type="url"');
  });

  it("conserve les états de feedback premium", () => {
    const source = readFileSync(path.join(process.cwd(), "components/ui/feedback.tsx"), "utf8");
    expect(source).toContain("ToastProvider");
    expect(source).toContain("ConfirmDialog");
    expect(source).toContain("SuccessState");
  });
});
