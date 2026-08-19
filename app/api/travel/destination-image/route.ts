import type { DestinationImage } from "@/lib/travel/destination-images";

export const runtime = "nodejs";

const fallback = (): DestinationImage => ({
  provider: "fallback", photoId: "", imageUrl: "", photographer: "", photographerUrl: "", attribution: "",
});

export async function GET(request: Request) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  const { searchParams } = new URL(request.url);
  const destination = searchParams.get("destination")?.trim().slice(0, 80) ?? "";
  const country = searchParams.get("country")?.trim().slice(0, 80) ?? "";
  if (!accessKey || !destination) return Response.json(fallback(), { headers: { "Cache-Control": "private, max-age=300" } });

  try {
    const query = `${destination} ${country} skyline travel`.trim();
    const endpoint = new URL("https://api.unsplash.com/search/photos");
    endpoint.search = new URLSearchParams({ query, orientation: "landscape", content_filter: "high", per_page: "1" }).toString();
    const response = await fetch(endpoint, {
      headers: { Authorization: `Client-ID ${accessKey}`, "Accept-Version": "v1" },
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    if (!response.ok) return Response.json(fallback());
    const payload = await response.json() as {
      results?: { id: string; urls?: { raw?: string }; user?: { name?: string; links?: { html?: string } }; links?: { html?: string; download_location?: string } }[];
    };
    const photo = payload.results?.[0];
    const raw = photo?.urls?.raw;
    if (!photo || !raw) return Response.json(fallback());
    const imageUrl = `${raw}${raw.includes("?") ? "&" : "?"}auto=format&fit=crop&w=1600&q=82`;
    const photographer = photo.user?.name ?? "";
    const photographerUrl = photo.user?.links?.html ? `${photo.user.links.html}?utm_source=budgy&utm_medium=referral` : "";
    if (photo.links?.download_location) {
      // Unsplash demande de déclencher ce endpoint lorsqu'une photo est retenue.
      await fetch(photo.links.download_location, { headers: { Authorization: `Client-ID ${accessKey}`, "Accept-Version": "v1" }, cache: "no-store" }).catch(() => undefined);
    }
    return Response.json({
      provider: "unsplash", photoId: photo.id, imageUrl, photographer, photographerUrl,
      attribution: photographer ? `Photo de ${photographer} sur Unsplash` : "Photo sur Unsplash",
    } satisfies DestinationImage, { headers: { "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=86400" } });
  } catch {
    return Response.json(fallback());
  }
}
