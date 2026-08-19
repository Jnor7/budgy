"use client";

import { ArrowDown, ArrowUp, GripVertical, Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/feedback";
import { AppPageHeader } from "@/components/ui/premium";
import { V2Icon, V2Switch } from "@/components/ui/v2";
import { useBudgyData } from "@/lib/data/data-provider";
import { MODULE_DEFINITIONS, moduleDefinition } from "@/lib/modules/registry";
import type { ModuleKey } from "@/types/domain";

const move = (items: ModuleKey[], from: number, to: number) => {
  const next = [...items]; const [item] = next.splice(from, 1); if (item) next.splice(to, 0, item); return next;
};

export default function ModulesSettingsPage() {
  const { modules, setModules, ready } = useBudgyData();
  const [selected, setSelected] = useState<ModuleKey[]>(modules);
  const [dirty, setDirty] = useState(false);
  const [lastKnown, setLastKnown] = useState(modules);
  const [saving, setSaving] = useState(false);
  const [dragged, setDragged] = useState<ModuleKey>();
  const [dropTarget, setDropTarget] = useState<ModuleKey>();
  const selectedRef = useRef(selected);
  const dragStart = useRef<{ key: ModuleKey; previous: ModuleKey[] } | undefined>(undefined);
  const { showToast } = useToast();

  if (ready && !dirty && modules !== lastKnown) {
    setLastKnown(modules); setSelected(modules);
  }
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const persist = async (next: ModuleKey[], previous = selectedRef.current) => {
    selectedRef.current = next; setSelected(next); setDirty(true); setSaving(true);
    try {
      await setModules(next);
      showToast({ title: "Modules mis à jour", detail: "La barre principale suit votre nouvel ordre.", tone: "success" });
    } catch {
      selectedRef.current = previous; setSelected(previous);
      showToast({ title: "Modification impossible", detail: "Vérifiez votre connexion puis réessayez.", tone: "error" });
    } finally { setSaving(false); }
  };
  const toggle = (key: ModuleKey) => void persist(selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key]);
  const reorderPreview = (key: ModuleKey, target: ModuleKey) => {
    setDropTarget(target);
    const current = selectedRef.current; const from = current.indexOf(key); const to = current.indexOf(target);
    if (from < 0 || to < 0 || from === to) return;
    const next = move(current, from, to); selectedRef.current = next; setSelected(next);
  };
  const finishPointerDrag = (cancelled = false) => {
    const start = dragStart.current; if (!start) return;
    const next = selectedRef.current; dragStart.current = undefined; setDragged(undefined); setDropTarget(undefined);
    if (cancelled) { selectedRef.current = start.previous; setSelected(start.previous); return; }
    if (next.join("|") !== start.previous.join("|")) void persist(next, start.previous);
  };
  const inactive = MODULE_DEFINITIONS.filter((definition) => !selected.includes(definition.key));

  return <main className="page v2-page v2"><AppPageHeader title="Mes modules" subtitle="Choisissez ce qui compte et l’ordre de votre navigation." backHref="/more" /><div className="v2-banner"><Info size={18} /><span>Les quatre premiers modules actifs apparaissent dans la barre principale. Masquer un module ne supprime jamais ses données.</span></div><section><div className="settings-section-title"><h2>Modules actifs</h2><span>{saving ? "Enregistrement…" : "Faites glisser pour réordonner"}</span></div><div className="module-order-list">{selected.map((key, index) => { const definition = moduleDefinition(key); return <article className={`module-order-row ${dragged === key ? "is-dragging" : ""} ${dropTarget === key && dragged !== key ? "is-drop-target" : ""}`} data-module-key={key} draggable onDragStart={() => { setDragged(key); dragStart.current = { key, previous: [...selectedRef.current] }; }} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragged) reorderPreview(dragged, key); finishPointerDrag(); }} onDragEnd={() => finishPointerDrag()} key={key}><button className="drag-handle" aria-label={`Déplacer ${definition.label}`} onPointerDown={(event) => { dragStart.current = { key, previous: [...selectedRef.current] }; setDragged(key); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-module-key]")?.dataset.moduleKey as ModuleKey | undefined; if (target) reorderPreview(key, target); }} onPointerUp={(event) => { event.currentTarget.releasePointerCapture(event.pointerId); finishPointerDrag(); }} onPointerCancel={() => finishPointerDrag(true)}><GripVertical aria-hidden="true" /></button><V2Icon icon={definition.icon} tone={definition.tone} /><span className="v2-row-main"><strong>{definition.label}</strong><span>{index < 4 ? `${key === "rentals" ? "Espace Business · " : ""}Position ${index + 1} dans la navigation` : "Disponible dans Options"}</span></span><span className="order-buttons"><button className="icon-button" disabled={index === 0 || saving} aria-label={`Monter ${definition.label}`} onClick={() => void persist(move(selected, index, index - 1))}><ArrowUp size={15} /></button><button className="icon-button" disabled={index === selected.length - 1 || saving} aria-label={`Descendre ${definition.label}`} onClick={() => void persist(move(selected, index, index + 1))}><ArrowDown size={15} /></button></span><V2Switch checked label={`Désactiver ${definition.label}`} onChange={() => toggle(key)} /></article>; })}{selected.length === 0 ? <p className="premium-empty-copy">Aucun module actif. L’accueil et Options restent accessibles.</p> : null}</div></section>{inactive.length > 0 ? <section><div className="settings-section-title"><h2>Autres modules</h2><span>Réactivables à tout moment</span></div><div className="v2-card">{inactive.map((definition) => <div className="v2-row" key={definition.key}><V2Icon icon={definition.icon} tone={definition.tone} /><span className="v2-row-main"><strong>{definition.label}</strong><span>{definition.description}</span></span><V2Switch checked={false} label={`Activer ${definition.label}`} onChange={() => toggle(definition.key)} /></div>)}</div></section> : null}</main>;
}
