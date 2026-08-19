export interface DestinationImage {
  provider: "unsplash" | "fallback";
  photoId: string;
  imageUrl: string;
  photographer: string;
  photographerUrl: string;
  attribution: string;
  diagnostic?: {
    query: string;
    status: number;
    errorType: string;
    resultsCount: number;
  };
}

export interface DestinationImageRequest {
  tripId?: string;
  excludePhotoId?: string;
}

export interface DestinationImageProvider {
  findLandscape(destination: string, country: string, request?: DestinationImageRequest): Promise<DestinationImage>;
}

const searchAliases: Record<string, string> = {
  dubai: "Dubai",
  tokyo: "Tokyo",
  paris: "Paris",
  "new york": "New York",
  "emirats arabes unis": "UAE",
  "united arab emirates": "UAE",
  japon: "Japan",
  japan: "Japan",
  france: "France",
  "etats unis": "USA",
  "etats-unis": "USA",
  "united states": "USA",
  usa: "USA",
};

const searchKey = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

export const destinationImageSearchQuery = (destination: string, country: string) => {
  const city = searchAliases[searchKey(destination)] ?? destination.trim();
  const nation = searchAliases[searchKey(country)] ?? country.trim();
  return `${city} ${nation} travel`.replace(/\s+/g, " ").trim();
};

export const fallbackDestinationImage = (): DestinationImage => ({
  provider: "fallback",
  photoId: "",
  imageUrl: "",
  photographer: "",
  photographerUrl: "",
  attribution: "",
});

export class ServerDestinationImageProvider implements DestinationImageProvider {
  async findLandscape(destination: string, country: string, request: DestinationImageRequest = {}) {
    const query = destinationImageSearchQuery(destination, country);
    try {
      const params = new URLSearchParams({ destination, country });
      if (request.tripId) params.set("tripId", request.tripId);
      if (request.excludePhotoId) params.set("excludePhotoId", request.excludePhotoId);
      const response = await fetch(`/api/travel/destination-image?${params}`, { cache: "no-store" });
      const image = await response.json() as DestinationImage;
      return image.imageUrl ? image : { ...fallbackDestinationImage(), diagnostic: image.diagnostic };
    } catch (reason) {
      return {
        ...fallbackDestinationImage(),
        diagnostic: {
          query,
          status: 0,
          errorType: reason instanceof SyntaxError ? "invalid_route_payload" : "route_request_failed",
          resultsCount: 0,
        },
      };
    }
  }
}

export const destinationImageProvider: DestinationImageProvider = new ServerDestinationImageProvider();
