export interface DestinationImage {
  provider: "unsplash" | "fallback";
  photoId: string;
  imageUrl: string;
  photographer: string;
  photographerUrl: string;
  attribution: string;
}

export interface DestinationImageProvider {
  findLandscape(destination: string, country: string): Promise<DestinationImage>;
}

export const fallbackDestinationImage = (): DestinationImage => ({
  provider: "fallback",
  photoId: "",
  imageUrl: "",
  photographer: "",
  photographerUrl: "",
  attribution: "",
});

export class ServerDestinationImageProvider implements DestinationImageProvider {
  async findLandscape(destination: string, country: string) {
    try {
      const params = new URLSearchParams({ destination, country });
      const response = await fetch(`/api/travel/destination-image?${params}`, { cache: "no-store" });
      if (!response.ok) return fallbackDestinationImage();
      const image = await response.json() as DestinationImage;
      return image.imageUrl ? image : fallbackDestinationImage();
    } catch {
      return fallbackDestinationImage();
    }
  }
}

export const destinationImageProvider: DestinationImageProvider = new ServerDestinationImageProvider();

