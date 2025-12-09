export const getThumbnailUrl = (url: string) => {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter((part) => part !== "");

    if (pathParts.length === 0) {
      return; // No path to process
    }

    const fileNameWithExt = pathParts.pop(); // e.g., "Ed_Hazel_1.jpg"

    if (!fileNameWithExt) {
      return;
    }

    const lastDotIndex = fileNameWithExt.lastIndexOf(".");
    let fileName = fileNameWithExt;
    const fileExtension = ".jpeg"; // Always JPEG for thumbnails

    if (lastDotIndex !== -1) {
      fileName = fileNameWithExt.substring(0, lastDotIndex);
    }

    const thumbnailFileName = `${fileName}-thumbnail${fileExtension}`;

    // Reconstruct the path with "thumbnails/" after the domain
    const newPath = ["thumbnails", ...pathParts, thumbnailFileName].join("/");

    urlObj.pathname = `/${newPath}`;

    return urlObj.toString();
  } catch (error) {
    console.error("Error constructing thumbnail URL:", error);

    return;
  }
};

export const getS3KeyFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);

    // Decode the URI component to handle special characters in S3 keys
    return decodeURIComponent(urlObj.pathname.replace(/^\//, ""));
  } catch (error) {
    console.error("Error extracting S3 key from URL:", error);

    return "";
  }
};

export const isImageUrl = (url: string): boolean => {
  // A more comprehensive list of image extensions
  const imageExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".bmp",
    ".webp",
    ".tiff",
    ".ico",
    ".svg",
    ".arw",
    ".cr2",
    ".crw",
    ".dng",
    ".erf",
    ".kdc",
    ".mrw",
    ".nef",
    ".orf",
    ".raf",
    ".raw",
    ".rw2",
    ".sr2",
    ".srf",
    ".x3f",
  ];
  const lowerCaseUrl = url.toLowerCase();

  // Extract the file extension from the URL
  const parts = lowerCaseUrl.split(".");
  const extension = parts.length > 1 ? `.${parts.pop()}` : "";

  return imageExtensions.includes(extension);
};
