"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/feedback";
import { Field, Sheet } from "@/components/ui/modal";
import { useBudgyData } from "@/lib/data/data-provider";
import { totalDueForMonth } from "@/lib/domain/tenants";
import { eur, monthLabel } from "@/lib/format";
import type { Tenant } from "@/types/domain";

const FRACTIONS = [
  { label: "Tout", value: 1 },
  { label: "3/4", value: .75 },
  { label: "1/2", value: .5 },
  { label: "1/4", value: .25 },
] as const;

export function RentPaymentSheet({ tenant, year, month, onClose }: {
  tenant?: Tenant;
  year: number;
  month: number;
  onClose: () => void;
}) {
  if (!tenant) return null;
  return <OpenRentPaymentSheet tenant={tenant} year={year} month={month} onClose={onClose} key={`${tenant.id}-${year}-${month}`} />;
}

function OpenRentPaymentSheet({ tenant, year, month, onClose }: { tenant: Tenant; year: number; month: number; onClose: () => void }) {
  const { data, create, update, remove } = useBudgyData();
  const { showToast } = useToast();
  const due = totalDueForMonth(tenant, data.rentPayments, data.tenantDebts, year, month);
  const payments = data.rentPayments.filter((payment) => payment.tenantId === tenant.id && payment.year === year && payment.month === month);
  const [amount, setAmount] = useState(() => payments.reduce((sum, payment) => sum + payment.amountReceived, 0));
  const [note, setNote] = useState(() => payments[0]?.note ?? "");

  const save = () => {
    if (amount < 0) return;
    const existing = payments[0];
    if (existing) {
      update("rentPayments", existing.id, { amountReceived: amount, isPaid: amount >= due, paidDate: amount > 0 ? new Date().toISOString() : undefined, note });
    } else {
      create("rentPayments", { tenantId: tenant.id, month, year, isPaid: amount >= due, paidDate: amount > 0 ? new Date().toISOString() : undefined, amountDue: due, amountReceived: amount, carryOver: Math.max(due - tenant.monthlyRent, 0), note });
    }
    onClose();
    showToast({ title: "Paiement enregistré", detail: `${tenant.name} · ${eur.format(amount)}`, tone: "success" });
  };

  const reset = () => {
    payments.forEach((payment) => remove("rentPayments", payment.id));
    setAmount(0);
    setNote("");
    showToast({ title: "Paiement remis à zéro", detail: tenant?.name, tone: "success" });
  };

  return (
    <Sheet open title="Enregistrer un paiement" submitLabel="Enregistrer" disableSubmit={amount < 0} onClose={onClose} onSubmit={save}>
      <div className="form-grid">
        <div className="payment-sheet-summary"><span><strong>{monthLabel(new Date(year, month - 1, 1))}</strong><small>{tenant.name}</small></span><span><small>Total dû</small><strong>{eur.format(due)}</strong></span></div>
        <Field label="Montant du versement"><input className="input amount-field" type="number" inputMode="decimal" value={amount || ""} onChange={(event) => setAmount(Number(event.target.value))} /></Field>
        <div className="payment-fractions" aria-label="Fraction du paiement">
          {FRACTIONS.map((fraction) => {
            const value = Math.round(due * fraction.value * 100) / 100;
            const active = Math.abs(amount - value) < .01;
            return <button className={active ? "active" : ""} aria-pressed={active} key={fraction.label} onClick={() => setAmount(value)}>{fraction.label}</button>;
          })}
        </div>
        <Field label="Note"><input className="input" placeholder="Virement, espèces, chèque…" value={note} onChange={(event) => setNote(event.target.value)} /></Field>
        <button className="button button-danger" onClick={reset}><RotateCcw size={17} /> Remettre le paiement à 0</button>
      </div>
    </Sheet>
  );
}
