"use client";

import { ArrowLeft, BellRing, CalendarDays, Check, CreditCard, Pause, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BubbleHeader, Card, MetricCard } from "@/components/ui/card";
import { RowMenu } from "@/components/ui/menu";
import { Field, FormModal, FormRow } from "@/components/ui/modal";
import { AmountField } from "@/components/ui/premium";
import { useBudgyData } from "@/lib/data/data-provider";
import { eur } from "@/lib/format";
import type { Subscription } from "@/types/domain";

type Draft = Omit<Subscription, "id" | "userId">;
const blank: Draft = { title:"", amount:0, dueDay:1, category:"Abonnement", systemImage:"creditcard.fill", colorHex:"#8050F2", scope:"Perso", isActive:true, note:"" };

export default function SubscriptionsPage() {
  const { data, create, update, remove } = useBudgyData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string>();
  const [draft, setDraft] = useState<Draft>(blank);
  const active = useMemo(() => data.subscriptions.filter((item) => item.isActive), [data.subscriptions]);
  const monthly = active.reduce((sum, item) => sum + item.amount, 0);
  const next = [...active].sort((a,b) => a.dueDay-b.dueDay)[0];
  const showCreate = () => { setEditing(undefined); setDraft(blank); setOpen(true); };
  const showEdit = (item: Subscription) => { setEditing(item.id); setDraft({title:item.title,amount:item.amount,dueDay:item.dueDay,category:item.category,systemImage:item.systemImage,colorHex:item.colorHex,scope:item.scope,isActive:item.isActive,note:item.note}); setOpen(true); };
  const save = () => { if (!draft.title.trim() || draft.amount <= 0) return; if (editing) update("subscriptions", editing, draft); else create("subscriptions", draft); setOpen(false); };

  return <main className="page page-narrow stack">
    <div className="spread"><Link className="icon-button" href="/"><ArrowLeft/></Link><strong>Abonnements</strong><span/></div>
    <BubbleHeader title="Abonnements" subtitle="Vos prélèvements récurrents" action={<button className="fab" aria-label="Ajouter un abonnement" onClick={showCreate}><Plus/></button>}/>
    <div className="grid-2"><MetricCard icon={CreditCard} label="Total mensuel" value={eur.format(monthly)}/><MetricCard icon={CalendarDays} label="Prochain prélèvement" value={next ? `Le ${next.dueDay}` : "Aucun"} detail={next?.title} tone="cyan"/></div>
    <Card><div className="spread"><h2 className="section-title">Mes abonnements</h2><span className="button button-soft">{active.length} actif(s)</span></div>
      {data.subscriptions.length===0?<p className="muted small">Aucun abonnement enregistré.</p>:data.subscriptions.map((item)=><div className="list-row" key={item.id}>
        <button className={`status-dot ${item.isActive?"active":""}`} aria-label={item.isActive?"Mettre en pause":"Réactiver"} onClick={()=>update("subscriptions",item.id,{isActive:!item.isActive})}>{item.isActive?<Check size={14}/>:<Pause size={12} className="muted"/>}</button>
        <span className="icon-tile icon-rose"><BellRing size={19}/></span><div className="list-main"><strong>{item.title}</strong><span className="muted small">Le {item.dueDay} · {item.scope} · {item.isActive?"Actif":"En pause"}</span></div><strong className={item.isActive?"accent":"muted"}>{eur.format(item.amount)}</strong><RowMenu onEdit={()=>showEdit(item)} onDelete={()=>remove("subscriptions",item.id)}/>
      </div>)}
    </Card>
    <FormModal open={open} title={editing?"Modifier l’abonnement":"Nouvel abonnement"} submitLabel={editing?"Enregistrer les modifications":"Ajouter l’abonnement"} disableSubmit={!draft.title.trim()||draft.amount<=0} onClose={()=>setOpen(false)} onSubmit={save} icon={BellRing} tone="rose"><div className="form-grid">
      <Field label="Nom"><input className="input" value={draft.title} placeholder="Netflix, iCloud…" onChange={(e)=>setDraft({...draft,title:e.target.value})}/></Field>
      <Field label="Montant mensuel"><AmountField size="modal" value={draft.amount} onChange={(amount)=>setDraft({...draft,amount})} autoFocus /></Field><FormRow><Field label="Jour de prélèvement"><input className="input" type="number" min="1" max="31" value={draft.dueDay} onChange={(e)=>setDraft({...draft,dueDay:Math.min(31,Math.max(1,Number(e.target.value)))})}/></Field><Field label="Catégorie"><input className="input" value={draft.category} onChange={(e)=>setDraft({...draft,category:e.target.value})}/></Field></FormRow><Field label="Compte"><input className="input" value={draft.scope} onChange={(e)=>setDraft({...draft,scope:e.target.value})}/></Field>
      <button type="button" className="card-flat spread" aria-pressed={draft.isActive} onClick={()=>setDraft({...draft,isActive:!draft.isActive})}><span>Abonnement actif</span><span className={`status-dot ${draft.isActive?"active":""}`}>{draft.isActive&&<Check size={14}/>}</span></button>
      <Field label="Note"><textarea className="textarea" value={draft.note} onChange={(e)=>setDraft({...draft,note:e.target.value})}/></Field>
    </div></FormModal>
  </main>;
}
