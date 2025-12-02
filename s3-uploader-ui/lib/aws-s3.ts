import axios from "axios";

const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL;

/**
 * Return auth header using the token stored in localStorage by the AuthProvider.
 * This keeps the UI modules (non-React) able to send the Authorization header.
 */
const authHeaders = () => {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("s3u_token");

  return token ? { Authorization: `Bearer ${token}` } : {};
};

export interface ListFilesResult {
  fileUrls: string[];
  imageThumbnailsUrls: string[];
  nextContinuationToken?: string;
}

export const listFilesFromS3 = async (): Promise<ListFilesResult> => {
  try {
    const response = await axios.get(`${BACKEND_API_URL}/files`, {
      headers: { ...authHeaders() },
    });
    const { fileUrls, imageThumbnailsUrls } = response.data;

    return { fileUrls, imageThumbnailsUrls };
  } catch (error) {
    throw error;
  }
};

export const processImageThumbnail = async (urls: string[]): Promise<any> => {
  try {
    await axios.post(
      `${BACKEND_API_URL}/thumbnails/generate`,
      {
        urls,
      },
      { headers: { "Content-Type": "application/json", ...authHeaders() } },
    );

    return { success: true };
  } catch (error) {
    throw error;
  }
};

export const deleteAllThumbnails = async (): Promise<any> => {
  try {
    await axios.delete(`${BACKEND_API_URL}/thumbnails/delete`, {
      headers: { ...authHeaders() },
    });

    return { success: true };
  } catch (error) {
    throw error;
  }
};
