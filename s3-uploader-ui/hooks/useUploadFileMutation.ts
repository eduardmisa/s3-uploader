import { uploadFileToS3 } from '@/lib/aws-s3';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface UploadMutationVariables {
  file: File;
  onProgress: (progress: number) => void;
}

export const useUploadFileMutation = (filePathPrefix?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, onProgress }: UploadMutationVariables) => {
      return uploadFileToS3(file, onProgress, filePathPrefix);
    },
    onSuccess: () => {
      // Invalidate and refetch the S3 files query after a successful upload
      queryClient.invalidateQueries({ queryKey: ['s3Files'] });
      // You might also want to update the local state of filesToUpload here
      // or handle it in the component that calls this mutation.
    },
    onError: (error, variables) => {
      console.error(`Failed to upload ${variables.file.name}:`, error);
    },
  });
};
