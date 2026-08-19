"use client";
import { ArrowRight,BarChart3,Boxes,Building2,ListChecks,PackageOpen,Plus,TrendingUp } from "lucide-react";
import Link from "next/link";
import { AppPageHeader } from "@/components/ui/premium";
import { useBudgyData } from "@/lib/data/data-provider";
import { eur } from "@/lib/format";

export default function BusinessPage(){
 const {data}=useBudgyData();
 const revenue=data.businessTransactions.filter((item)=>item.type==="revenu").reduce((sum,item)=>sum+item.amount,0);
 const expenses=data.businessTransactions.filter((item)=>item.type==="depense").reduce((sum,item)=>sum+item.amount,0);
 const openTasks=data.businessTasks.filter((item)=>!item.isDone).length;
 const stock=data.dubaiParts.reduce((sum,item)=>sum+Math.max(item.quantityBought-item.quantitySold,0),0);
 return <main className="page business-page"><AppPageHeader title="Business" subtitle="Pilotez vos activités en un coup d’œil." action={<Link className="compact-add" href="/business/generic" aria-label="Créer une activité"><Plus size={18}/> Activité</Link>}/>
  <section className="business-hero"><div><span>Résultat net</span><strong>{eur.format(revenue-expenses)}</strong><small>{revenue?`${Math.round((revenue-expenses)/revenue*100)} % de marge`:"Ajoutez vos premières transactions"}</small></div><TrendingUp size={34}/></section>
  <section className="business-kpis"><article><span><BarChart3 size={17}/></span><strong>{eur.format(revenue)}</strong><small>Chiffre d’affaires</small></article><article><span><ListChecks size={17}/></span><strong>{openTasks}</strong><small>Tâches ouvertes</small></article><article><span><Boxes size={17}/></span><strong>{data.businessBookings.length}</strong><small>Réservations</small></article></section>
  <section className="business-areas"><div className="section-heading"><h2>Espaces de gestion</h2><span>{data.businesses.length+2} environnements</span></div><Link className="business-area rent-area" href="/business/tenants"><span className="business-area-icon"><Building2/></span><span><strong>Gestion des loyers</strong><small>{data.tenants.length} locataire{data.tenants.length>1?"s":""} · {eur.format(data.tenants.reduce((sum,item)=>sum+item.monthlyRent,0))}/mois</small></span><ArrowRight size={18}/></Link><Link className="business-area dubai-area" href="/business/dubai"><span className="business-area-icon"><PackageOpen/></span><span><strong>Business Dubaï</strong><small>{data.dubaiParts.length} références · {stock} unités restantes</small></span><ArrowRight size={18}/></Link><Link className="business-area generic-area" href="/business/generic"><span className="business-area-icon"><Boxes/></span><span><strong>Mes activités</strong><small>{data.businesses.length} business configuré{data.businesses.length>1?"s":""}</small></span><ArrowRight size={18}/></Link></section>
 </main>;
}
