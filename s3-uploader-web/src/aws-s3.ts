import axios from 'axios';

// Removed direct AWS SDK S3 client configuration
// const s3 = new AWS.S3();
// const S3_BUCKET = import.meta.env.VITE_S3_BUCKET_NAME;

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL;

interface UploadProgressEvent {
  loaded: number;
  total: number;
}

export const uploadFileToS3 = async (file: File, onProgress: (progress: number) => void): Promise<any> => {
  try {
    // 1. Get presigned URL from backend
    const response = await axios.post(`${BACKEND_API_URL}/upload`, {
      fileName: (file as any).webkitRelativePath || file.name,
      contentType: file.type,
    });
    const { presignedUrl } = response.data;

    // 2. Upload file directly to S3 using the presigned URL
    await axios.put(presignedUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });

    // The upload is handled directly to S3 via the presigned URL.
    // The frontend no longer needs to construct the S3 object URL.
    // Return a generic success object.
    return { success: true };

  } catch (error) {
    console.error("Error in uploadFileToS3:", error);
    throw error;
  }
};

export interface ListImagesResult {
  imageUrls: string[];
  nextContinuationToken?: string;
}

export const listImagesFromS3 = async (limit: number, continuationToken?: string): Promise<ListImagesResult> => {
  try {
    const response = await axios.get(`${BACKEND_API_URL}/files`, {
      params: {
        limit,
        continuationToken,
      },
    });
    const { imageUrls, nextContinuationToken } = response.data;
    return { imageUrls, nextContinuationToken };
  } catch (error) {
    console.error("Error listing images from S3 via backend:", error);
    throw error;
  }
};
