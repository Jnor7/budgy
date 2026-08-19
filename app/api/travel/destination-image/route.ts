import { destinationImageSearchQuery, type DestinationImage } from "@/lib/travel/destination-images";

export const runtime = "nodejs";

type Diagnostic = NonNullable<DestinationImage["diagnostic"]>;

const fallback = (diagnostic: Diagnostic): DestinationImage => ({
  provider: "fallback", photoId: "", imageUrl: "", photographer: "", photographerUrl: "", attribution: "", diagnostic,
});

const diagnosticMessage = (diagnostic: Diagnostic) => {
  if (!diagnostic.errorType) return "Photo Unsplash sélectionnée.";
  if (diagnostic.errorType === "configuration_missing") return "UNSPLASH_ACCESS_KEY absente du runtime.";
  if (diagnostic.errorType === "destination_missing") return "Destination absente de la requête.";
  if (diagnostic.errorType.startsWith("unsplash_http_")) return `Réponse HTTP ${diagnostic.status} reçue d’Unsplash.`;
  if (diagnostic.errorType === "download_tracking_failed") return "Suivi du téléchargement Unsplash indisponible.";
  if (diagnostic.errorType === "no_results") return "Aucun résultat Unsplash.";
  if (diagnostic.errorType === "no_alternative_photo") return "Aucune photo alternative disponible.";
  if (diagnostic.errorType === "invalid_photo_payload" || diagnostic.errorType === "invalid_unsplash_payload") return "Réponse Unsplash invalide.";
  return "Requête Unsplash impossible.";
};

const logPipeline = (values: Diagnostic) => {
  const event = {
    provider: "unsplash",
    status: values.status,
    code: values.errorType || "ok",
    message: diagnosticMessage(values),
  };
  if (values.errorType) console.error("[travel-image]", event);
  else console.info("[travel-image]", event);
};

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  const { searchParams } = new URL(request.url);
  const destination = searchParams.get("destination")?.trim().slice(0, 80) ?? "";
  const country = searchParams.get("country")?.trim().slice(0, 80) ?? "";
  const excludePhotoId = searchParams.get("excludePhotoId")?.trim().slice(0, 80) ?? "";
  const query = destinationImageSearchQuery(destination, country);
  if (!accessKey || !destination) {
    const diagnostic = { query, status: 0, errorType: !accessKey ? "configuration_missing" : "destination_missing", resultsCount: 0 };
    logPipeline(diagnostic);
    return Response.json(fallback(diagnostic), { headers: noStore });
  }

  try {
    const endpoint = new URL("https://api.unsplash.com/search/photos");
    endpoint.search = new URLSearchParams({ query, orientation: "landscape", content_filter: "high", per_page: "8" }).toString();
    const response = await fetch(endpoint, {
      headers: { Authorization: `Client-ID ${accessKey}`, "Accept-Version": "v1" },
      cache: "no-store",
    });
    if (!response.ok) {
      const diagnostic = { query, status: response.status, errorType: `unsplash_http_${response.status}`, resultsCount: 0 };
      logPipeline(diagnostic);
      return Response.json(fallback(diagnostic), { status: response.status, headers: noStore });
    }
    const payload = await response.json() as {
      results?: { id: string; urls?: { raw?: string }; user?: { name?: string; links?: { html?: string } }; links?: { html?: string; download_location?: string } }[];
    };
    const results = Array.isArray(payload.results) ? payload.results : [];
    const photo = excludePhotoId ? results.find((candidate) => candidate.id !== excludePhotoId) : results[0];
    const raw = photo?.urls?.raw;
    if (!photo || !raw) {
      const diagnostic = {
        query,
        status: response.status,
        errorType: excludePhotoId && results.length ? "no_alternative_photo" : results.length ? "invalid_photo_payload" : "no_results",
        resultsCount: results.length,
      };
      logPipeline(diagnostic);
      return Response.json(fallback(diagnostic), { headers: noStore });
    }
    const imageUrl = `${raw}${raw.includes("?") ? "&" : "?"}auto=format&fit=crop&w=1600&q=82`;
    const photographer = photo.user?.name?.trim() || "Photographe Unsplash";
    const photographerUrl = photo.user?.links?.html ? `${photo.user.links.html}?utm_source=budgy&utm_medium=referral` : "";
    if (photo.links?.download_location) {
      // Unsplash demande de déclencher ce endpoint lorsqu'une photo est retenue.
      const download = await fetch(photo.links.download_location, { headers: { Authorization: `Client-ID ${accessKey}`, "Accept-Version": "v1" }, cache: "no-store" }).catch(() => null);
      if (!download?.ok) logPipeline({ query, status: download?.status ?? 0, errorType: "download_tracking_failed", resultsCount: results.length });
    }
    logPipeline({ query, status: response.status, errorType: "", resultsCount: results.length });
    return Response.json({
      provider: "unsplash", photoId: photo.id, imageUrl, photographer, photographerUrl,
      attribution: photographer ? `Photo de ${photographer} sur Unsplash` : "Photo sur Unsplash",
      diagnostic: { query, status: response.status, errorType: "", resultsCount: results.length },
    } satisfies DestinationImage, { headers: noStore });
  } catch (reason) {
    const diagnostic = { query, status: 0, errorType: reason instanceof SyntaxError ? "invalid_unsplash_payload" : "unsplash_request_failed", resultsCount: 0 };
    logPipeline(diagnostic);
    return Response.json(fallback(diagnostic), { headers: noStore });
  }
}
