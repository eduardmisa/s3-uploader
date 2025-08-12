import { useMutation, useQueryClient } from "@tanstack/react-query";

import { uploadFileToS3 } from "@/lib/aws-s3";

interface UploadMutationVariables {
  file: File;
  onProgress: (progress: number) => void;
}

export const useUploadFileMutation = (filePathPrefix?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, onProgress }: UploadMutationVariables) => {
      return uploadFileToS3(file, onProgress, filePathPrefix);
    }
  });
};
