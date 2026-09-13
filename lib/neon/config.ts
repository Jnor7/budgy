export type BudgyDataMode = "auto" | "local" | "neon";

export const neonAuthBaseUrl = process.env.NEON_AUTH_BASE_URL?.trim();
export const neonDataApiUrl = process.env.NEON_DATA_API_URL?.trim();

const requestedMode = process.env.NEXT_PUBLIC_BUDGY_DATA_MODE?.trim().toLowerCase();
export const budgyDataMode: BudgyDataMode =
  requestedMode === "local" || requestedMode === "neon" ? requestedMode : "auto";

// Les URL Neon restent côté serveur. Le navigateur passe par les proxies same-origin.
export const isNeonConfigured = Boolean(neonAuthBaseUrl && neonDataApiUrl);
export const usesNeon = budgyDataMode !== "local";
export const hasInvalidNeonMode = false;
