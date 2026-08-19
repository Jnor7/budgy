"use client";

import {
  ChevronRight, FileArchive, LogOut, RefreshCcw,
  Settings2, SlidersHorizontal, UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { V2Avatar, V2Icon } from "@/components/ui/v2";
import { SyncBadge } from "@/components/ui/premium";
import { useToast } from "@/components/ui/feedback";
import { useBudgyData } from "@/lib/data/data-provider";
import { signOut } from "@/services/auth";
import { moduleDefinition } from "@/lib/modules/registry";

const SECTIONS = [
  { href: "/settings/account", icon: UserRound, label: "Mon compte", detail: "Pseudo, avatar et mot de passe", tone: "purple" as const },
  { href: "/settings/modules", icon: SlidersHorizontal, label: "Mes modules", detail: "Activer ou désactiver des fonctions", tone: "purple" as const },
  { href: "/settings", icon: Settings2, label: "Préférences", detail: "Devise et affichage", tone: "cyan" as const },
  { href: "/settings/migration", icon: FileArchive, label: "Migration historique", detail: "Importer une archive Budget JR", tone: "purple" as const },
];

export default function MorePage() {
  const { data, modules, profile, localMode, syncStatus, reload, userId } = useBudgyData();
  const router = useRouter();
  const { showToast } = useToast();

  const logout = async () => {
    await signOut();
    router.replace("/auth");
    router.refresh();
  };

  return (
    <main className="page v2-page v2">
      <header className="v2-greet">
        <div>
          <h1>Mon espace</h1>
          <p>Votre Budgy, vos préférences.</p>
        </div>
      </header>

      <Link className="profile-identity" href="/settings/account">
        <V2Avatar name={profile?.username ?? "Budgy"} url={profile?.avatarUrl || undefined} large />
        <div className="list-main">
          <strong style={{ fontSize: 17 }}>{profile?.username ?? "Mon compte"}</strong>
          <SyncBadge status={syncStatus} local={localMode} />
        </div>
        <ChevronRight className="muted" />
      </Link>

      <section className="profile-stats" aria-label="Statistiques personnelles"><div><strong>{data.budgetEntries.length}</strong><span>Transactions</span></div><div><strong>{data.trips.length}</strong><span>Voyages</span></div><div><strong>{data.businesses.length}</strong><span>Activités</span></div><div><strong>{data.tenants.length}</strong><span>Locataires</span></div></section>

      <section className="v2-card">
        {SECTIONS.map((section) => (
          <Link className="v2-row" href={section.href} key={section.label}>
            <V2Icon icon={section.icon} tone={section.tone} />
            <span className="v2-row-main">
              <strong>{section.label}</strong>
              <span>{section.detail}</span>
            </span>
            <ChevronRight size={18} className="muted" />
          </Link>
        ))}
      </section>

      {modules.length > 4 ? <section><div className="section-heading"><h2>Mes modules</h2><span>Actifs hors barre principale</span></div><div className="v2-card">{modules.slice(4).map((key) => { const definition = moduleDefinition(key); return <Link className="v2-row" href={definition.href} key={key}><V2Icon icon={definition.icon} tone={definition.tone} /><span className="v2-row-main"><strong>{definition.label}</strong><span>{definition.tagline}</span></span><ChevronRight size={18} className="muted" /></Link>; })}</div></section> : null}

      <section className="v2-card">
        {!localMode ? (
          <button className="v2-row" disabled={syncStatus === "loading" || syncStatus === "syncing"} onClick={() => void reload().then(()=>showToast({title:"Données actualisées",tone:"success"})).catch(()=>showToast({title:"Actualisation impossible",tone:"error"}))}>
            <V2Icon icon={RefreshCcw} tone="cyan" />
            <span className="v2-row-main">
              <strong>Actualiser les données</strong>
              <span>{syncStatus === "syncing" ? "Synchronisation en cours…" : "Recharger depuis Supabase"}</span>
            </span>
          </button>
        ) : null}
        {!localMode ? (
          <button className="v2-row" onClick={() => void logout()}>
            <V2Icon icon={LogOut} tone="red" />
            <span className="v2-row-main">
              <strong>Se déconnecter</strong>
              <span>Fermer la session sur cet appareil</span>
            </span>
          </button>
        ) : null}
      </section>

      <p className="muted small" style={{ textAlign: "center" }}>Budgy V2.5.3 · identifiant {userId.slice(0, 8)}…</p>
    </main>
  );
}
