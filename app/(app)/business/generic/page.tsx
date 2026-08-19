"use client";

import { BriefcaseBusiness, Check, ChevronRight, Plus, Search, ToggleLeft, ToggleRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RowMenu } from "@/components/ui/menu";
import { Field, FormModal } from "@/components/ui/modal";
import { V2Empty, V2Icon } from "@/components/ui/v2";
import { useBudgyData } from "@/lib/data/data-provider";
import { BUSINESS_FEATURES, BUSINESS_TEMPLATES, businessTemplate } from "@/lib/modules/registry";
import type { Business, BusinessTemplate } from "@/types/domain";

type Draft = Omit<Business, "id" | "userId" | "createdAt">;

const featureKeys = BUSINESS_FEATURES.map((feature) => feature.key);

/** Un nouveau business part des flags du template choisi (§10). */
const draftFromTemplate = (template: BusinessTemplate, base?: Draft): Draft => {
  const defaults = businessTemplate(template).defaults;
  const flags = Object.fromEntries(
    featureKeys.map((key) => [key, defaults[key] ?? false]),
  ) as Pick<Draft, (typeof featureKeys)[number]>;
  return {
    name: base?.name ?? "",
    type: base?.type ?? businessTemplate(template).label,
    template,
    icon: base?.icon ?? "briefcase",
    colorHex: base?.colorHex ?? "#8B5CF6",
    note: base?.note ?? "",
    isActive: base?.isActive ?? true,
    ...flags,
  };
};

export default function GenericBusinessesPage() {
  const { data, create, update, remove } = useBudgyData();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string>();
  const [draft, setDraft] = useState<Draft>(() => draftFromTemplate("simple"));

  const filtered = useMemo(
    () => data.businesses.filter((business) => business.name.toLowerCase().includes(query.toLowerCase())),
    [data.businesses, query],
  );

  const startCreate = () => {
    setEditing(undefined);
    setDraft(draftFromTemplate("simple"));
    setOpen(true);
  };

  const startEdit = (business: Business) => {
    setEditing(business.id);
    const { id, userId, createdAt, ...rest } = business;
    void id; void userId; void createdAt;
    setDraft({ ...rest, template: rest.template ?? "simple" });
    setOpen(true);
  };

  const save = () => {
    if (!draft.name.trim()) return;
    if (editing) update("businesses", editing, draft);
    else create("businesses", { ...draft, createdAt: new Date().toISOString() });
    setOpen(false);
  };

  return (
    <main className="page v2-page v2">
      <header className="v2-greet">
        <div>
          <h1>Mes business</h1>
          <p>Chaque activité possède ses propres fonctions.</p>
        </div>
        <button className="fab" aria-label="Créer un business" onClick={startCreate}><Plus /></button>
      </header>

      <div className="v2-card v2-card-tight row">
        <Search className="muted" size={19} />
        <input
          className="input" style={{ border: 0, background: "transparent", padding: 0, minHeight: 38 }}
          placeholder="Rechercher un business…" value={query} onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {data.businesses.length === 0 ? (
        <V2Empty
          icon={BriefcaseBusiness}
          title="Aucune activité pour le moment 💼"
          text="Créez votre première activité et choisissez le modèle qui lui correspond : commerce, services, location ou import/export."
          action={<button className="button button-primary" onClick={startCreate}>Créer un business</button>}
        />
      ) : null}

      {filtered.map((business) => (
        <section className="v2-card" key={business.id}>
          <div className="spread">
            <Link href={`/business/generic/${business.id}`} className="row" style={{ minWidth: 0, flex: 1 }}>
              <V2Icon icon={BriefcaseBusiness} tone="purple" />
              <div className="list-main">
                <strong>{business.name}</strong>
                <div className="muted small">
                  {businessTemplate(business.template ?? "simple").label} · {featureKeys.filter((key) => business[key]).length} fonctions
                </div>
              </div>
              <ChevronRight className="muted" />
            </Link>
            <RowMenu onEdit={() => startEdit(business)} onDelete={() => remove("businesses", business.id)} />
          </div>
          <button className="v2-row" onClick={() => update("businesses", business.id, { isActive: !business.isActive })}>
            {business.isActive ? <ToggleRight className="positive" /> : <ToggleLeft className="muted" />}
            <span className="v2-row-main"><strong>{business.isActive ? "Activité en cours" : "Activité en pause"}</strong></span>
          </button>
        </section>
      ))}

      {data.businesses.length > 0 && filtered.length === 0 ? (
        <p className="muted small" style={{ textAlign: "center" }}>Aucun business ne correspond à cette recherche.</p>
      ) : null}

      <FormModal
        open={open}
        title={editing ? "Modifier le business" : "Créer un business"}
        submitLabel={editing ? "Enregistrer les modifications" : "Créer le business"}
        disableSubmit={!draft.name.trim()}
        onClose={() => setOpen(false)}
        onSubmit={save}
        icon={BriefcaseBusiness} tone="orange"
      >
        <div className="form-grid">
          <Field label="Nom">
            <input className="input" value={draft.name} placeholder="Import Export Congo, Boutique vêtements…" onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </Field>

          <h3 className="section-title" style={{ marginBottom: 0 }}>Modèle d&apos;activité</h3>
          <p className="muted small" style={{ margin: 0 }}>Le modèle pré-active les fonctions les plus utiles. Vous pouvez tout ajuster ensuite.</p>
          <div className="v2-modules">
            {BUSINESS_TEMPLATES.map((template) => (
              <button
                type="button" className="v2-module" key={template.key}
                aria-pressed={draft.template === template.key}
                onClick={() => setDraft(draftFromTemplate(template.key, draft))}
              >
                <span className="v2-module-body">
                  <strong>{template.label}</strong>
                  <span>{template.description}</span>
                </span>
                <span className="v2-check">{draft.template === template.key ? <Check size={14} strokeWidth={3} /> : null}</span>
              </button>
            ))}
          </div>

          <h3 className="section-title" style={{ marginBottom: 0 }}>Que souhaitez-vous gérer&nbsp;?</h3>
          {BUSINESS_FEATURES.map((feature) => (
            <button
              type="button" className="card-flat spread" key={feature.key}
              onClick={() => setDraft({ ...draft, [feature.key]: !draft[feature.key] })}
            >
              <strong>{feature.label}</strong>
              <span className={`status-dot ${draft[feature.key] ? "active" : ""}`}>
                {draft[feature.key] ? <Check size={14} /> : null}
              </span>
            </button>
          ))}

          <Field label="Note">
            <textarea className="textarea" value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
          </Field>
        </div>
      </FormModal>
    </main>
  );
}
