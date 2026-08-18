"use client";

import { ArrowRight, BriefcaseBusiness, ChartNoAxesCombined, Plane, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const steps = [
  {
    icon: WalletCards,
    title: "Votre argent, enfin clair",
    text: "Suivez le réalisé, l’attendu et vos abonnements sans perdre le fil.",
    color: "icon-purple",
  },
  {
    icon: BriefcaseBusiness,
    title: "Vos activités au même endroit",
    text: "Pilotez business, loyers et stock Dubaï avec une vision simple.",
    color: "icon-orange",
  },
  {
    icon: Plane,
    title: "Préparez chaque voyage",
    text: "Centralisez vols, logements, activités, check-list et budget voyage.",
    color: "icon-cyan",
  },
] as const;

export default function OnboardingPage() {
  const [index, setIndex] = useState(0);
  const router = useRouter();
  const step = steps[index] ?? steps[0]!;
  const Icon = step.icon;

  const finish = () => {
    window.localStorage.setItem("budgy.onboarding_done", "1");
    document.cookie = "budgy_onboarding_done=1; Path=/; Max-Age=31536000; SameSite=Lax";
    router.replace("/");
    router.refresh();
  };

  return <main className="onboarding-shell">
    <button className="button button-ghost onboarding-skip" onClick={finish}>Passer</button>
    <div className="onboarding-visual" aria-hidden="true">
      <div className={`onboarding-icon ${step.color}`}><Icon size={58}/></div>
      <ChartNoAxesCombined className="onboarding-chart" size={92}/>
    </div>
    <section className="onboarding-copy">
      <div className="onboarding-dots" aria-label={`Étape ${index + 1} sur ${steps.length}`}>
        {steps.map((item, dot) => <i className={dot === index ? "active" : ""} key={item.title}/>) }
      </div>
      <h1>{step.title}</h1>
      <p>{step.text}</p>
      <button className="button button-primary onboarding-next" onClick={() => index === steps.length - 1 ? finish() : setIndex(index + 1)}>
        {index === steps.length - 1 ? "Commencer" : "Continuer"}<ArrowRight size={19}/>
      </button>
    </section>
  </main>;
}
