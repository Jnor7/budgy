export const bankingMessages = {
  session: "Votre session a expiré. Reconnectez-vous à Budgy.",
  unavailable: "Le service bancaire est temporairement indisponible.",
  unconfigured: "Connexion bancaire non configurée.",
  invalid: "Cette demande est invalide ou a expiré.",
  missing: "Élément bancaire introuvable.",
  duplicate: "Cette banque est déjà connectée.",
  busy: "Une opération est déjà en cours pour cette banque.",
  bank_unavailable: "La banque est temporairement indisponible. Réessayez plus tard.",
  rate_limit: "La limite de synchronisation de la banque est atteinte. Réessayez demain.",
  processing: "La banque prépare les données. Réessayez dans quelques minutes.",
  pending: "Le consentement est en attente de validation.",
  refused: "Le consentement a été refusé ou interrompu.",
  expired: "Connexion à renouveler.",
  revoked: "La connexion bancaire a été révoquée.",
  budget_link: "Cette entrée Budget est indisponible ou déjà associée.",
} as const;

export type BankingErrorCode = keyof typeof bankingMessages;

export class BankingError extends Error {
  constructor(readonly code: BankingErrorCode, readonly status = 503) {
    super(bankingMessages[code]);
  }
}
