"use client";

import { useState } from "react";
import { destinationFlag } from "@/lib/travel/destinations";

export function TravelCover({
  imageUrl, destination, countryCode, className = "", eager = false, children,
}: {
  imageUrl?: string; destination: string; countryCode?: string; className?: string;
  eager?: boolean; children?: React.ReactNode;
}) {
  const [failedUrl, setFailedUrl] = useState("");
  const showImage = Boolean(imageUrl) && failedUrl !== imageUrl;
  return (
    <div className={`travel-cover ${showImage ? "has-image" : "is-fallback"} ${className}`.trim()}>
      {showImage ? (
        // L'URL peut provenir d'un historique importé : <img> conserve la compatibilité multi-provider.
        // L'URL Unsplash stockée est déjà redimensionnée côté provider.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={`Vue de ${destination}`} loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setFailedUrl(imageUrl ?? "")} />
      ) : (
        <div className="travel-cover-fallback" aria-hidden="true">
          <span>{destinationFlag(destination, countryCode)}</span>{children ? null : <b>{destination}</b>}
        </div>
      )}
      <div className="travel-cover-shade" />
      {children ? <div className="travel-cover-content">{children}</div> : null}
    </div>
  );
}
