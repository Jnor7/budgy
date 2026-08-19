"use client";
import { ArrowLeft, CheckCircle2, CloudCog, FileArchive, LogIn, RefreshCcw, ShieldCheck, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { readBudgetJrArchive, mergeImportedData, type ArchivePreview } from "@/features/migration/importer";
import { describeSupabaseError } from "@/lib/errors";
import { useBudgyData } from "@/lib/data/data-provider";
import { resolveMigrationAvailability, MIGRATION_AVAILABILITY_MESSAGES } from "@/lib/data/migration-state";
import { deleteAttachmentFile, uploadAttachmentFile } from "@/services/attachments";

/**
 * Bannière de statut Supabase pour l'import distant. Les quatre états sont
 * mutuellement exclusifs et couvrent exactement les cas du bug historique :
 * un compte configuré-mais-pas-encore-connecté n'affiche plus jamais le
 * message "nécessite le mode Supabase", qui est faux dans ce cas précis.
 */
function AvailabilityBanner({ availability }: { availability: ReturnType<typeof resolveMigrationAvailability> }) {
  if (availability === "ready") return null;
  const message = MIGRATION_AVAILABILITY_MESSAGES[availability];
  if (availability === "connecting") {
    return <div className="v2-banner"><CloudCog size={18} style={{ flex: "0 0 auto" }} className="accent" /><span>{message}</span></div>;
  }
  if (availability === "signed-out") {
    return (
      <div className="v2-banner">
        <LogIn size={18} style={{ flex: "0 0 auto" }} className="accent" />
        <span>{message} <Link className="v2-link" href="/auth">Se connecter</Link></span>
      </div>
    );
  }
  return <p className="error">{message}</p>;
}

export default function MigrationPage() {
  const { data, replaceAll, importArchive, localMode, userId, ready, repositoryReady } = useBudgyData();
  const [preview, setPreview] = useState<ArchivePreview>();
  const [error, setError] = useState("");
  const [report, setReport] = useState("");
  const [busy, setBusy] = useState(false);

  const availability = resolveMigrationAvailability({ localMode, ready, repositoryReady });
  // L'archive peut toujours être lue et prévisualisée hors ligne : seule l'exécution
  // distante dépend de Supabase. Le mode local, lui, importe directement en local.
  const canExecute = localMode || availability === "ready";

  const select = async (file: File) => {
    setError("");
    setReport("");
    try {
      setPreview(await readBudgetJrArchive(file));
    } catch (reason) {
      setError(describeSupabaseError(reason, "Archive invalide."));
    }
  };

  const execute = async () => {
    if (!preview) return;
    setBusy(true);
    setError("");
    const incoming = structuredClone(preview.data);
    const uploaded: string[] = [];
    try {
      for (const item of preview.attachmentFiles) {
        const attachment = incoming.attachments.find((entry) => entry.id === item.attachmentId);
        if (!attachment) continue;
        attachment.storagePath = await uploadAttachmentFile(item.file, userId, localMode);
        attachment.sizeBytes = item.file.size;
        attachment.mimeType = item.file.type || attachment.mimeType;
        uploaded.push(attachment.storagePath);
      }
      if (localMode) {
        const result = mergeImportedData(data, incoming);
        replaceAll(result.data);
        setReport(`${result.inserted} éléments importés · ${result.skipped} doublons ignorés.`);
      } else {
        const result = await importArchive(incoming, preview.checksum);
        if (result.alreadyImported) for (const path of uploaded) await deleteAttachmentFile(path, false).catch(() => undefined);
        setReport(result.alreadyImported
          ? "Cette archive a déjà été importée. Aucun doublon créé."
          : `${result.inserted} éléments importés · ${result.skipped} doublons ignorés${result.batchId ? ` · lot ${result.batchId.slice(0, 8)}` : ""}.`);
      }
    } catch (reason) {
      for (const path of uploaded) await deleteAttachmentFile(path, localMode).catch(() => undefined);
      // Le message reflète toujours la vraie cause (session, réseau, archive, erreur
      // Supabase avec son `hint`) — jamais un "Import impossible" générique qui
      // masquerait le diagnostic. Voir lib/errors.ts.
      setError(describeSupabaseError(reason, "Import impossible."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page page-narrow stack">
      <div className="spread">
        <Link className="icon-button" href="/"><ArrowLeft /></Link>
        <strong>Migration Budget JR</strong>
        <span className="icon-button"><ShieldCheck className="positive" /></span>
      </div>
      <div className="bubble-header"><h1 style={{ fontSize: 30 }}>Importer mes données</h1><p>Budget JR → Budgy</p></div>

      <AvailabilityBanner availability={availability} />

      <Card>
        <div className="row">
          <span className="icon-tile icon-purple"><FileArchive /></span>
          <div><strong>budget-jr-export.zip</strong><div className="muted small">Manifest v1, 21 entités et pièces jointes</div></div>
        </div>
        <label className="button button-primary" style={{ width: "100%", marginTop: 14 }}>
          <Upload size={17} />Choisir l’archive
          <input type="file" accept=".zip,application/zip" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void select(file); }} />
        </label>
        {error && <p className="error">{error}</p>}
      </Card>

      {preview && (
        <Card>
          <div className="spread"><h2 className="section-title">Résumé avant import</h2><span className="button button-soft">v{preview.manifest.version}</span></div>
          <div className="stack-sm">
            {Object.entries(preview.counts).map(([key, count]) => <div className="spread" key={key}><span className="muted">{key}</span><strong>{count}</strong></div>)}
          </div>
          {preview.attachmentFiles.length > 0 && <p className="positive small">{preview.attachmentFiles.length} fichier(s) prêt(s) à être transféré(s).</p>}
          {preview.warnings.map((warning) => <p className="error" key={warning}>{warning}</p>)}
          <button
            className="button button-primary" disabled={busy || !canExecute}
            style={{ width: "100%", marginTop: 16 }} onClick={() => void execute()}
          >
            <CheckCircle2 size={18} />{busy ? "Import en cours…" : "Importer dans Budgy"}
          </button>
          {!canExecute && availability !== "local" && (
            <p className="muted small" style={{ textAlign: "center", marginTop: 8, marginBottom: 0 }}>
              L’import démarrera automatiquement dès que la connexion Supabase sera prête.
            </p>
          )}
        </Card>
      )}

      {report && (
        <Card>
          <div className="row"><CheckCircle2 className="positive" /><strong>{report}</strong></div>
          <p className="muted small">L’import est idempotent grâce au checksum et aux legacy_id. Relancer la même archive n’ajoute pas les mêmes éléments.</p>
        </Card>
      )}

      <Card>
        <div className="row">
          <RefreshCcw className="accent" />
          <div><strong>Import récupérable</strong><div className="muted small">Aucune donnée existante n’est effacée. Les doublons sont ignorés et le rapport reste visible.</div></div>
        </div>
      </Card>
    </main>
  );
}
