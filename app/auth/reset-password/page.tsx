"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/modal";
import { authClient } from "@/lib/auth/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setMessage("");

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const urlError = params.get("error");

    if (urlError) {
      setMessage("Le lien de réinitialisation est invalide ou expiré.");
      return;
    }

    if (!token) {
      setMessage(
        "Token de réinitialisation absent. Demandez un nouveau lien depuis « Mot de passe oublié »."
      );
      return;
    }

    setBusy(true);

    try {
      const { error } = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (error) {
        setMessage(error.message ?? "Impossible de modifier le mot de passe.");
        return;
      }

      setMessage("Mot de passe mis à jour. Vous pouvez maintenant vous connecter.");
    } catch (reason) {
  console.error("[RESET PASSWORD ERROR]", reason);

  setMessage(
    reason instanceof Error
      ? reason.message
      : "Impossible de modifier le mot de passe."
  );
} finally {
      setBusy(false);
    }
  };

  return (
    <main className="page page-narrow stack" style={{ paddingBottom: 30 }}>
      <div className="bubble-header">
        <h1 style={{ fontSize: 30 }}>Nouveau mot de passe</h1>
        <p>Sécurisez votre compte Budgy</p>
      </div>

      <Card>
        <div className="form-grid">
          <Field label="Nouveau mot de passe">
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <button
            className="button button-primary"
            disabled={password.length < 8 || busy}
            onClick={() => void submit()}
          >
            {busy ? "Enregistrement..." : "Enregistrer"}
          </button>

          {message && <p className="small">{message}</p>}

          <Link className="button button-ghost" href="/auth">
            Retour à la connexion
          </Link>
        </div>
      </Card>
    </main>
  );
}