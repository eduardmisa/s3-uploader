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
