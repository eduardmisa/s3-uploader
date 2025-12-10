import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import { uploadThumbnailToS3 } from "@/lib/aws-s3";
import { getThumbnailUrl, getS3KeyFromUrl, isImageUrl } from "@/utils/urlUtil";

interface ProcessImageThumbnailMutationVariables {
  items: { url: string }[];
}

const generateThumbnail = async (imageUrl: string): Promise<Blob | null> => {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await axios.get(imageUrl, {
        responseType: "blob",
        withCredentials: true,
        headers: {
          Cookie: `CloudFront-Key-Pair-Id=${document.cookie.match(/CloudFront-Key-Pair-Id=([^;]+)/)?.[1]}; CloudFront-Policy=${document.cookie.match(/CloudFront-Policy=([^;]+)/)?.[1]}; CloudFront-Signature=${document.cookie.match(/CloudFront-Signature=([^;]+)/)?.[1]}`,
        },
      });
      const imageBlob = response.data;

      const img = new Image();

      img.src = URL.createObjectURL(imageBlob);

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 200;
        const scaleSize = MAX_WIDTH / img.width;

        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Could not get canvas context"));

          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Canvas toBlob failed"));
            }
          },
          "image/jpeg",
          0.9,
        ); // Quality 0.9 for JPEG
        URL.revokeObjectURL(img.src); // Clean up the object URL
      };

      img.onerror = (error) => {
        reject(new Error(`Failed to load image: ${imageUrl}, error: ${error}`));
      };
    } catch (error: any) {
      reject(error);
    }
  });
};

export const useProcessImageThumbnailMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ items }: ProcessImageThumbnailMutationVariables) => {
      const BATCH_SIZE = 10;
      const allResults: { url: string; status: string; error?: string }[] = [];

      for (let i = 0; i < 20; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (item) => {
            try {
              const fullImageUrl = `https://cdn.file-manager.emisa.me/${item.url}`;

              if (!isImageUrl(fullImageUrl)) {
                return {
                  url: item.url,
                  status: "skipped",
                  error: "Not an image file",
                };
              }

              const thumbnailUrl = getThumbnailUrl(fullImageUrl);

              if (!thumbnailUrl) {
                return {
                  url: item.url,
                  status: "failed",
                  error: "Could not generate thumbnail URL",
                };
              }

              const thumbnailBlob = await generateThumbnail(fullImageUrl);

              if (thumbnailBlob) {
                const thumbnailKey = getS3KeyFromUrl(thumbnailUrl);

                await uploadThumbnailToS3(thumbnailBlob, thumbnailKey);

                return { url: item.url, status: "success" };
              }

              return {
                url: item.url,
                status: "failed",
                error: "Thumbnail generation failed",
              };
            } catch (error: any) {
              return { url: item.url, status: "failed", error: error.message };
            }
          }),
        );

        allResults.push(...batchResults);
      }

      return allResults;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["s3Files"] });
    },
  });
};
