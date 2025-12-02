import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteAllThumbnails } from "@/lib/aws-s3";

export const useDeleteAllThumbnailsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAllThumbnails,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["s3Files"] });
    },
  });
};
