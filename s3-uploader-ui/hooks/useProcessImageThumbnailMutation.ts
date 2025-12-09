import { useMutation, useQueryClient } from "@tanstack/react-query";

import { uploadThumbnailToS3 } from "@/lib/aws-s3";
import { getThumbnailUrl, getS3KeyFromUrl } from "@/utils/urlUtil";

interface ProcessImageThumbnailMutationVariables {
  items: { url: string }[];
}

const generateThumbnail = async (imageUrl: string): Promise<Blob | null> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = imageUrl;

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
    };

    img.onerror = (error) => {
      reject(new Error(`Failed to load image: ${imageUrl}, error: ${error}`));
    };
  });
};

export const useProcessImageThumbnailMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ items }: ProcessImageThumbnailMutationVariables) => {
      const results = await Promise.all(
        items.map(async (item) => {
          try {
            const fullImageUrl = `https://cdn.file-manager.emisa.me/${item.url}`;
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

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["s3Files"] });
    },
  });
};
