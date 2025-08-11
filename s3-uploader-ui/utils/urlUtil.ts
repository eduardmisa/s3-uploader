export const getThumbnailUrl = (url: string) => {
  try {
    // Preserve any query string or hash
    const idx = url.search(/[#?]/);
    const base = idx === -1 ? url : url.slice(0, idx);
    const suffix = idx === -1 ? "" : url.slice(idx);

    const parts = base.split("/");
    const fileName = parts.pop();

    if (!fileName) return false;

    const fileSplit = fileName.split(".");

    if (!fileSplit || fileSplit.length < 2) return false;

    const ext = fileSplit.pop();
    const fileNameOnly = fileSplit.join(".");
    const thumbnailFile = `${fileNameOnly}-thumbnail.${ext}`;

    parts.push(thumbnailFile);

    return parts.join("/") + suffix;
  } catch {
    return;
  }
};
