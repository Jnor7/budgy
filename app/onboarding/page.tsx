"use client";

import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { V2ModuleCard } from "@/components/ui/v2";
import { useBudgyData } from "@/lib/data/data-provider";
import { MODULE_DEFINITIONS, suggestedModules } from "@/lib/modules/registry";
import type { ModuleKey } from "@/types/domain";

const markSeen = () => {
  window.localStorage.setItem("budgy.onboarding_done", "1");
  document.cookie = "budgy_onboarding_done=1; Path=/; Max-Age=31536000; SameSite=Lax";
};

export default function OnboardingPage() {
  const router = useRouter();
  const { data, ready, modules, modulesConfigured, profile, setModules, localMode } = useBudgyData();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<ModuleKey[]>([]);
  // Les données peuvent arriver après le premier rendu : on n'aligne la présélection
  // qu'une fois, dès que `ready` bascule, sans écraser un choix déjà en cours.
  const [hasSeeded, setHasSeeded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /** Compte V1 découvrant la V2 : on part de ses données réelles, jamais d'un pseudo. */
  const returning = modulesConfigured && !profile?.modulesConfiguredAt;
  const defaults = useMemo(
    () => (modulesConfigured ? modules : suggestedModules(data)),
    [data, modules, modulesConfigured],
  );

  if (ready && !hasSeeded) {
    setHasSeeded(true);
    setSelected(defaults.length > 0 ? defaults : ["budget"]);
  }

  const toggle = (key: ModuleKey) =>
    setSelected((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );

  const finish = async () => {
    setSaving(true);
    setError("");
    try {
      await setModules(selected);
      markSeen();
      router.replace("/");
      router.refresh();
    } catch {
      setError("La configuration n'a pas pu être enregistrée. Vérifiez votre connexion et réessayez.");
      setSaving(false);
    }
  };

  const skip = () => {
    markSeen();
    router.replace("/");
    router.refresh();
  };

  return (
    <main className="v2-onboarding">
      <div className="spread">
        {step > 0 ? (
          <button className="icon-button" aria-label="Étape précédente" onClick={() => setStep(step - 1)}>
            <ArrowLeft />
          </button>
        ) : (
          <span />
        )}
        <div className="v2-progress" style={{ width: 96 }} aria-hidden="true">
          <i className="done" />
          <i className={step >= 1 ? "done" : ""} />
        </div>
        {modulesConfigured ? (
          <button className="button button-ghost" onClick={skip}>Plus tard</button>
        ) : (
          <span />
        )}
      </div>

      {step === 0 ? (
        <section className="v2-onboarding-scroll" style={{ display: "grid", alignContent: "center", gap: 18 }}>
          <span className="v2-empty-icon" style={{ width: 76, height: 76 }}><Sparkles size={34} /></span>
          <div>
            <h1>{returning ? "Personnalisez votre nouveau Budgy" : "Bienvenue sur Budgy 👋"}</h1>
            <p className="lead">
              {returning
                ? "Budgy devient modulaire. Vérifiez les fonctions que vous souhaitez garder — vos données restent intactes quoi qu'il arrive."
                : "Construisons votre espace selon vos besoins. Vous ne verrez que les fonctions qui vous servent."}
            </p>
          </div>
        </section>
      ) : (
        <section className="v2-onboarding-scroll">
          <h1 style={{ fontSize: 26 }}>Comment voulez-vous utiliser Budgy&nbsp;?</h1>
          <p className="lead" style={{ marginBottom: 20 }}>
            Choisissez une ou plusieurs fonctions. Tout reste modifiable dans Réglages → Mes modules.
          </p>
          <div className="v2-modules">
            {MODULE_DEFINITIONS.map((definition) => (
              <V2ModuleCard
                key={definition.key}
                icon={definition.icon}
                tone={definition.tone}
                title={definition.label}
                text={definition.tagline}
                selected={selected.includes(definition.key)}
                onToggle={() => toggle(definition.key)}
              />
            ))}
          </div>
          {localMode ? (
            <p className="v2-banner" style={{ marginTop: 16 }}>
              Mode local : votre configuration est conservée dans ce navigateur.
            </p>
          ) : null}
        </section>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {error ? <p className="error">{error}</p> : null}
        <button
          className="button button-primary onboarding-next"
          disabled={saving || (step === 1 && selected.length === 0)}
          onClick={() => (step === 0 ? setStep(1) : void finish())}
        >
          {step === 0 ? "Commencer" : saving ? "Enregistrement…" : "Créer mon espace"}
          <ArrowRight size={19} />
        </button>
        {step === 1 && selected.length === 0 ? (
          <p className="muted small" style={{ textAlign: "center", margin: 0 }}>
            Sélectionnez au moins une fonction pour continuer.
          </p>
        ) : null}
      </div>
    </main>
  );
}
