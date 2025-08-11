import { useMutation, useQueryClient } from "@tanstack/react-query";

import { processImageThumbnail } from "@/lib/aws-s3";

interface UploadMutationVariables {
  urls: string[];
}

export const useProcessImageThumbnailMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ urls }: UploadMutationVariables) => {
      return processImageThumbnail(urls);
    },
    onSuccess: () => {
      // Invalidate and refetch the S3 files query after a successful upload
      queryClient.invalidateQueries({ queryKey: ["s3Files"] });
      // You might also want to update the local state of filesToUpload here
      // or handle it in the component that calls this mutation.
    },
  });
};
