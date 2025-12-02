import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL;

interface S3File {
  Key: string;
  LastModified: string;
  Size: number;
  ETag: string;
}

export const useListS3FilesForSync = () => {
  return useQuery<S3File[]>({
    queryKey: ["s3FilesForSync"],
    queryFn: async () => {
      const response = await axios.get(`${BACKEND_API_URL}/sync/files`);

      return response.data.s3Files;
    },
  });
};
