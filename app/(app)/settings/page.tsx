"use client";

import { ArrowLeft, CheckCircle2, Cloud, LogOut, RefreshCcw, RotateCcw, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { useBudgyData } from "@/lib/data/data-provider";
import { signOut } from "@/services/auth";

export default function SettingsPage() {
  const { localMode, syncError, syncStatus, reload } = useBudgyData();
  const router = useRouter();
  const replayOnboarding = () => {
    localStorage.removeItem("budgy.onboarding_done");
    document.cookie = "budgy_onboarding_done=; Path=/; Max-Age=0; SameSite=Lax";
    router.replace("/onboarding");
    router.refresh();
  };
  const logout = async () => {
    await signOut();
    router.replace("/auth");
    router.refresh();
  };
  return <main className="page page-narrow stack">
    <div className="spread"><Link className="icon-button" href="/"><ArrowLeft/></Link><strong>Réglages</strong><span/></div>
    <div className="bubble-header"><h1 style={{fontSize:30}}>Compte & données</h1><p>Confidentialité et synchronisation</p></div>
    <Card><div className="row"><span className={`icon-tile ${localMode?"icon-orange":"icon-green"}`}>{localMode?<Smartphone/>:<Cloud/>}</span><div className="list-main"><strong>{localMode?"Mode local":"Supabase connecté"}</strong><span className="muted small">{localMode?"Données conservées dans ce navigateur":"Données privées synchronisées avec RLS"}</span></div>{syncStatus==="idle"&&<CheckCircle2 className="positive"/>}</div>
      {syncError&&<p className="error">{syncError}</p>}
      {!localMode&&<button className="button button-soft" disabled={syncStatus==="loading"||syncStatus==="syncing"} style={{width:"100%",marginTop:14}} onClick={()=>void reload()}><RefreshCcw size={17}/>Actualiser les données</button>}
    </Card>
    <Card><button className="list-row" onClick={replayOnboarding}><RotateCcw className="accent"/><div className="list-main"><strong>Revoir la présentation</strong><span className="muted small">Relancer les trois écrans d’accueil</span></div></button>
      {!localMode&&<button className="list-row negative" onClick={()=>void logout()}><LogOut/><div className="list-main"><strong>Se déconnecter</strong><span className="muted small">Fermer la session sur cet appareil</span></div></button>}
    </Card>
  </main>;
}
