"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/feedback";
import { Field, Sheet } from "@/components/ui/modal";
import { AmountField, FormSection } from "@/components/ui/premium";
import { useBudgyData } from "@/lib/data/data-provider";
import type { Tenant } from "@/types/domain";

const MONTHS = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(new Date(2026, index, 1)));

export function RentDebtSheet({ tenant, year, initialMonth, onClose }: { tenant?: Tenant; year: number; initialMonth: number; onClose: () => void }) {
  if (!tenant) return null;
  return <OpenRentDebtSheet tenant={tenant} year={year} initialMonth={initialMonth} onClose={onClose} key={`${tenant.id}-${year}-${initialMonth}`} />;
}

function OpenRentDebtSheet({ tenant, year, initialMonth, onClose }: { tenant: Tenant; year: number; initialMonth: number; onClose: () => void }) {
  const { create } = useBudgyData();
  const { showToast } = useToast();
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState(0);
  const [month, setMonth] = useState(initialMonth);

  const save = () => {
    if (!label.trim() || amount <= 0) return;
    create("tenantDebts", { tenantId: tenant.id, label, amount, month, year, isPaid: false, createdAt: new Date().toISOString() });
    onClose();
    showToast({ title: "Dette ajoutée", detail: `${tenant.name} · ${MONTHS[month - 1]} ${year}`, tone: "success" });
  };

  return <Sheet open title="Ajouter une dette" submitLabel="Ajouter" disableSubmit={!label.trim() || amount <= 0} onClose={onClose} onSubmit={save}><div className="form-grid"><Field label="Montant"><AmountField value={amount} onChange={setAmount} autoFocus /></Field><FormSection title="Détails" hint="Cette dette utilise le calcul de report existant et reste rattachée au mois choisi."><Field label="Type de dette"><select className="select" value={label} onChange={(event) => setLabel(event.target.value)}><option value="">Choisir…</option><option>Retard de loyer</option><option>Charges</option><option>Réparation</option><option>Autre dette</option></select></Field><Field label="Mois"><select className="select" value={month} onChange={(event) => setMonth(Number(event.target.value))}>{MONTHS.map((name, index) => <option value={index + 1} key={name}>{name} {year}</option>)}</select></Field></FormSection></div></Sheet>;
}
