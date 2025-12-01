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

export const uploadFileToS3 = async (
  file: File,
  onProgress: (progress: number) => void,
  filePathPrefix?: string,
): Promise<any> => {
  try {
    // 1. Get presigned URL from backend (include auth header if present)
    const response = await axios.post(
      `${BACKEND_API_URL}/upload`,
      {
        fileName: (file as any).webkitRelativePath || file.name,
        contentType: file.type || file.name.split(".").pop(),
        filePathPrefix,
      },
      { headers: { "Content-Type": "application/json", ...authHeaders() } },
    );
    const { presignedUrl } = response.data;

    // 2. Upload file directly to S3 using the presigned URL
    await axios.put(presignedUrl, file, {
      headers: {
        "Content-Type": file.type,
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total,
          );

          onProgress(percentCompleted);
        }
      },
    });

    // The upload is handled directly to S3 via the presigned URL.
    // The frontend no longer needs to construct the S3 object URL.
    // Return a generic success object.
    return { success: true };
  } catch (error) {
    throw error;
  }
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
    await axios.delete(
      `${BACKEND_API_URL}/thumbnails/delete`,
      { headers: { ...authHeaders() } },
    );

    return { success: true };
  } catch (error) {
    throw error;
  }
};
