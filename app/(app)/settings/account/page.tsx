"use client";

import { ArrowLeft, Camera, KeyRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/ui/modal";
import { V2Avatar } from "@/components/ui/v2";
import { useBudgyData } from "@/lib/data/data-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { requestPasswordReset } from "@/services/auth";
import { fullDate } from "@/lib/format";

export default function AccountPage() {
  const { profile, saveProfile, userId, localMode } = useBudgyData();
  const [username, setUsername] = useState(() => profile?.username ?? "");
  // Trace la dernière valeur de profil connue pour détecter son arrivée asynchrone
  // sans écraser une saisie en cours (pattern React officiel : "Adjusting state on prop change").
  const [lastKnownUsername, setLastKnownUsername] = useState(profile?.username);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (profile?.username !== lastKnownUsername) {
    setLastKnownUsername(profile?.username);
    setUsername(profile?.username ?? "");
  }

  useEffect(() => {
    let cancelled = false;
    void getSupabaseBrowserClient()?.auth.getUser().then(({ data }) => {
      if (!cancelled) setEmail(data.user?.email ?? "");
    });
    return () => { cancelled = true; };
  }, []);

  const saveUsername = async () => {
    const trimmed = username.trim();
    if (trimmed.length < 2) { setError("Le pseudo doit contenir au moins 2 caractères."); return; }
    setError("");
    try {
      await saveProfile({ username: trimmed });
      setStatus("Pseudo mis à jour.");
    } catch {
      setError("Ce pseudo est peut-être déjà pris. Essayez-en un autre.");
    }
  };

  const uploadAvatar = async (file: File) => {
    const client = getSupabaseBrowserClient();
    if (!client) { setError("L'avatar nécessite le mode Supabase."); return; }
    setError("");
    setStatus("Envoi de la photo…");
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `${userId}/avatar-${Date.now()}.${extension}`;
    const { error: uploadError } = await client.storage.from("budgy-avatars").upload(path, file, { upsert: true });
    if (uploadError) { setError("La photo n'a pas pu être envoyée."); setStatus(""); return; }
    const { data } = client.storage.from("budgy-avatars").getPublicUrl(path);
    await saveProfile({ avatarUrl: data.publicUrl });
    setStatus("Photo mise à jour.");
  };

  const resetPassword = async () => {
    if (!email) return;
    await requestPasswordReset(email);
    setStatus("Un e-mail de réinitialisation vient de partir.");
  };

  return (
    <main className="page v2-page v2">
      <div className="spread">
        <Link className="icon-button" href="/more" aria-label="Retour"><ArrowLeft /></Link>
        <strong>Mon compte</strong>
        <span />
      </div>

      <section className="v2-card" style={{ display: "grid", justifyItems: "center", gap: 12, textAlign: "center" }}>
        <div style={{ position: "relative" }}>
          <V2Avatar name={profile?.username ?? "Budgy"} url={profile?.avatarUrl || undefined} large />
          <button
            className="fab" style={{ position: "absolute", right: -10, bottom: -8, width: 34, height: 34 }}
            aria-label="Changer la photo" onClick={() => fileRef.current?.click()}
          >
            <Camera size={16} />
          </button>
          <input
            ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden
            onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAvatar(file); }}
          />
        </div>
        <div>
          <strong style={{ fontSize: 18 }}>{profile?.username ?? "Mon compte"}</strong>
          <div className="muted small">{email || (localMode ? "Mode local" : "—")}</div>
          {profile?.createdAt ? <div className="muted small">Membre depuis le {fullDate(profile.createdAt)}</div> : null}
        </div>
      </section>

      <section className="v2-card">
        <div className="v2-card-head"><h2>Identité</h2></div>
        <div className="form-grid">
          <Field label="Pseudo Budgy">
            <input className="input" value={username} onChange={(event) => setUsername(event.target.value)} />
          </Field>
          <p className="muted small" style={{ margin: 0 }}>
            Votre pseudo permet à vos amis de vous inviter sur un voyage.
          </p>
          <button className="button button-primary" onClick={() => void saveUsername()}>Enregistrer</button>
        </div>
      </section>

      {!localMode ? (
        <section className="v2-card">
          <button className="v2-row" onClick={() => void resetPassword()}>
            <span className="v2-tile-icon" style={{ background: "#f2ebff", color: "var(--v2-violet)" }}><KeyRound size={19} /></span>
            <span className="v2-row-main">
              <strong>Changer mon mot de passe</strong>
              <span>Recevoir un lien de réinitialisation par e-mail</span>
            </span>
          </button>
        </section>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
      {status ? <p className="positive small" style={{ textAlign: "center" }}>{status}</p> : null}
    </main>
  );
}
