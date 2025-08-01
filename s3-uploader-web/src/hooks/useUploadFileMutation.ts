import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadFileToS3 } from '../aws-s3';
import type { FileUploadState } from '../App'; // Assuming FileUploadState is exported from App.tsx

interface UploadMutationVariables {
  file: File;
  onProgress: (progress: number) => void;
}

export const useUploadFileMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, onProgress }: UploadMutationVariables) => {
      return uploadFileToS3(file, onProgress);
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch the S3 images query after a successful upload
      queryClient.invalidateQueries({ queryKey: ['s3Images'] });
      // You might also want to update the local state of filesToUpload here
      // or handle it in the component that calls this mutation.
    },
    onError: (error, variables) => {
      console.error(`Failed to upload ${variables.file.name}:`, error);
    },
  });
};
