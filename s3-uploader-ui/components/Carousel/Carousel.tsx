import React, { useEffect, useMemo, useRef } from "react";
import ImageGallery from "react-image-gallery";
import "react-image-gallery/styles/css/image-gallery.css";

interface ICarousel {
  urls: string[];
  selectedUrl: string;
}
export const Carousel = ({ urls, selectedUrl }: ICarousel) => {
  // Memoize items so the gallery receives a stable reference unless urls change
  const items = useMemo(
    () =>
      urls.map((url) => ({
        original: url.replace("-thumbnail.", "."),
        thumbnail: url,
      })),
    [urls],
  );

  // Compute the index of the selected URL (fallback to 0)
  const selectedUrlIndex = useMemo(() => {
    const idx = urls.findIndex((u) => u === selectedUrl);

    return idx >= 0 ? idx : 0;
  }, [urls, selectedUrl]);

  // Use a ref to call slideToIndex when selectedUrlIndex changes, because
  // ImageGallery's `startIndex` only affects the initial mount.
  const galleryRef = useRef<any | null>(null);

  useEffect(() => {
    if (
      galleryRef.current &&
      typeof galleryRef.current.slideToIndex === "function"
    ) {
      galleryRef.current.slideToIndex(selectedUrlIndex);
    }
  }, [selectedUrlIndex]);

  return (
    <ImageGallery
      ref={galleryRef}
      items={items}
      showFullscreenButton={false}
      showPlayButton={false}
      startIndex={selectedUrlIndex}
      thumbnailPosition="left"
    />
  );
};
