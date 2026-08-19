import http from "node:http";
import type { AddressInfo } from "node:net";
import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";
import { SupabaseRepository } from "@/lib/data/supabase-repository";
import { emptyData } from "@/lib/data/seed";

/**
 * Régression du bug "No API key found in request" (HTTP 400 Supabase).
 *
 * Ce test n'utilise AUCUN mock du SDK Supabase : il construit un vrai client
 * via `createClient()` (exactement ce que `@supabase/ssr`'s `createBrowserClient`
 * fait en interne) pointé vers un vrai serveur HTTP local (127.0.0.1, aucun
 * réseau externe), et vérifie que la requête HTTP réellement envoyée par
 * `SupabaseRepository.importArchive()` porte l'en-tête `apikey` et
 * `Authorization`. Un retour à un `fetch()` manuel sans ces en-têtes ferait
 * échouer ce test immédiatement.
 */

const ANON_KEY = "test-anon-key-for-regression";

interface CapturedRequest {
  method?: string;
  url?: string;
  headers: http.IncomingHttpHeaders;
  body: string;
}

function startCapturingServer(respond: (req: CapturedRequest) => { status: number; body: unknown }) {
  let captured: CapturedRequest | undefined;
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk: Buffer) => { raw += chunk.toString("utf8"); });
    req.on("end", () => {
      captured = { method: req.method, url: req.url, headers: req.headers, body: raw };
      const { status, body } = respond(captured);
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    });
  });
  return {
    server,
    getCaptured: () => captured,
    listen: () => new Promise<string>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const { port } = server.address() as AddressInfo;
        resolve(`http://127.0.0.1:${port}`);
      });
    }),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe("import_budgy_archive — jamais d'appel réseau sans apikey", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it("SupabaseRepository.importArchive() envoie apikey + Authorization via supabase.rpc(), sans fetch() manuel", async () => {
    const harness = startCapturingServer(() => ({
      status: 200,
      body: { inserted: 3, skipped: 1, batch_id: "batch-123", already_imported: false },
    }));
    cleanup = harness.close;
    const baseUrl = await harness.listen();

    // Client réel, identique dans son fonctionnement à celui produit par
    // `getSupabaseBrowserClient()` en production (@supabase/ssr enveloppe ce
    // même `createClient` sans modifier la gestion des en-têtes).
    const client = createClient(baseUrl, ANON_KEY);
    const repository = new SupabaseRepository(client);

    const result = await repository.importArchive(emptyData, "checksum-abc");

    const captured = harness.getCaptured();
    expect(captured).toBeDefined();
    expect(captured?.method).toBe("POST");
    expect(captured?.url).toBe("/rest/v1/rpc/import_budgy_archive");

    // Le cœur de la régression : ces deux en-têtes doivent TOUJOURS être présents.
    // Leur absence est exactement ce qui produit "No API key found in request".
    expect(captured?.headers.apikey).toBe(ANON_KEY);
    expect(captured?.headers.authorization).toBe(`Bearer ${ANON_KEY}`);

    // Le corps transporte bien les paramètres RPC attendus, pas une charge vide
    // qui indiquerait un contournement du client officiel.
    const payload = JSON.parse(captured?.body ?? "{}") as Record<string, unknown>;
    expect(payload.p_format_version).toBe(1);
    expect(payload.p_checksum).toBe("checksum-abc");
    expect(payload).toHaveProperty("p_payload");

    expect(result).toEqual({ inserted: 3, skipped: 1, batchId: "batch-123", alreadyImported: false });
  });

  it("le client authentifié (avec session) envoie le JWT de session, pas la clé anonyme, en Authorization", async () => {
    const fakeAccessToken = "session-jwt-abc123";
    const harness = startCapturingServer(() => ({ status: 200, body: { inserted: 0, skipped: 0 } }));
    cleanup = harness.close;
    const baseUrl = await harness.listen();

    // `accessToken` simule une session utilisateur active : le SDK utilise alors
    // le JWT de session pour Authorization, tout en gardant `apikey` = clé anonyme.
    const client = createClient(baseUrl, ANON_KEY, {
      accessToken: () => Promise.resolve(fakeAccessToken),
    });
    const repository = new SupabaseRepository(client);
    await repository.importArchive(emptyData, "checksum-xyz");

    const captured = harness.getCaptured();
    expect(captured?.headers.apikey).toBe(ANON_KEY);
    expect(captured?.headers.authorization).toBe(`Bearer ${fakeAccessToken}`);
  });

  it("une erreur Supabase (ex. apikey manquante côté serveur) remonte avec message ET hint exploitables", async () => {
    const harness = startCapturingServer(() => ({
      status: 400,
      body: { message: "No API key found in request", hint: "No `apikey` request header or url param was found." },
    }));
    cleanup = harness.close;
    const baseUrl = await harness.listen();

    const client = createClient(baseUrl, ANON_KEY);
    const repository = new SupabaseRepository(client);

    await expect(repository.importArchive(emptyData, "checksum-err")).rejects.toMatchObject({
      message: "No API key found in request",
      hint: "No `apikey` request header or url param was found.",
    });
  });
});
