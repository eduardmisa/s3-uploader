import axios from "axios";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL;
const S3_BUCKET_NAME = process.env.NEXT_PUBLIC_S3_BUCKET_NAME;
const S3_REGION = process.env.NEXT_PUBLIC_S3_REGION;

const s3Client = new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || "",
  },
});

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

export const uploadThumbnailToS3 = async (
  file: File | Blob,
  key: string,
): Promise<any> => {
  try {
    const parallelUploads3 = new Upload({
      client: s3Client,
      params: {
        Bucket: S3_BUCKET_NAME,
        Key: key,
        Body: file,
        ContentType: "image/jpeg", // Always JPEG for thumbnails
        ACL: "bucket-owner-full-control",
      },
      queueSize: 4, // optional total number of concurrent uploads
      partSize: 1024 * 1024 * 5, // optional size of each part, in bytes, at least 5MB
      leavePartsOnError: false, // optional manually handle dropped parts
    });

    await parallelUploads3.done();
    return { success: true };
  } catch (error) {
    throw error;
  }
};
