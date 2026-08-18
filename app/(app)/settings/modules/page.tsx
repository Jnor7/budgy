"use client";

import { ArrowLeft, Info } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { V2Icon, V2Switch } from "@/components/ui/v2";
import { useBudgyData } from "@/lib/data/data-provider";
import { MODULE_DEFINITIONS } from "@/lib/modules/registry";
import type { ModuleKey } from "@/types/domain";

/**
 * Réglages → Mes modules (§5).
 * Désactiver un module masque la fonctionnalité : aucune donnée n'est supprimée.
 */
export default function ModulesSettingsPage() {
  const { modules, setModules, ready } = useBudgyData();
  const [selected, setSelected] = useState<ModuleKey[]>(modules);
  // `modules` peut arriver après le premier rendu : on aligne la sélection tant que
  // l'utilisateur n'a pas commencé à interagir avec les interrupteurs.
  const [lastKnownModules, setLastKnownModules] = useState(modules);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  if (ready && modules !== lastKnownModules && status === "idle") {
    setLastKnownModules(modules);
    setSelected(modules);
  }

  const toggle = async (key: ModuleKey) => {
    const next = selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key];
    setSelected(next);
    setStatus("saving");
    try {
      await setModules(next);
      setStatus("saved");
    } catch {
      setSelected(selected);
      setStatus("error");
    }
  };

  return (
    <main className="page v2-page v2">
      <div className="spread">
        <Link className="icon-button" href="/more" aria-label="Retour"><ArrowLeft /></Link>
        <strong>Mes modules</strong>
        <span />
      </div>

      <header>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-.02em" }}>Mes modules</h1>
        <p className="muted" style={{ marginTop: 6 }}>Adaptez Budgy à votre vie. Vous pouvez changer d&apos;avis à tout moment.</p>
      </header>

      <div className="v2-banner">
        <Info size={18} style={{ flex: "0 0 auto", marginTop: 1 }} />
        <span>Désactiver un module masque uniquement la fonctionnalité. Vos données sont conservées et vous pourrez le réactiver à tout moment.</span>
      </div>

      <section className="v2-card">
        {MODULE_DEFINITIONS.map((definition) => (
          <div className="v2-row" key={definition.key}>
            <V2Icon icon={definition.icon} tone={definition.tone} />
            <span className="v2-row-main">
              <strong>{definition.label}</strong>
              <span>{definition.description}</span>
            </span>
            <V2Switch
              checked={selected.includes(definition.key)}
              label={`${selected.includes(definition.key) ? "Désactiver" : "Activer"} ${definition.label}`}
              onChange={() => void toggle(definition.key)}
            />
          </div>
        ))}
      </section>

      {status === "error" ? <p className="error">La modification n&apos;a pas pu être enregistrée. Réessayez.</p> : null}
      {status === "saved" ? <p className="positive small" style={{ textAlign: "center" }}>Modules mis à jour.</p> : null}
      {selected.length === 0 ? (
        <p className="muted small" style={{ textAlign: "center" }}>
          Aucun module actif : Budgy n&apos;affichera que l&apos;accueil et vos réglages.
        </p>
      ) : null}
    </main>
  );
}
