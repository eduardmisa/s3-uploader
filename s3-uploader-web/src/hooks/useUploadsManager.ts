import { useState, useCallback } from 'react';
import { useUploadFileMutation } from './useUploadFileMutation';
import type { FileUploadState } from '../App'; // Assuming FileUploadState is exported from App.tsx

interface UseUploadsManagerProps {
  filesToUpload: FileUploadState[];
  setFilesToUpload: React.Dispatch<React.SetStateAction<FileUploadState[]>>;
  setUploadedFileNames: React.Dispatch<React.SetStateAction<string[]>>;
}

export const useUploadsManager = ({ filesToUpload, setFilesToUpload, setUploadedFileNames }: UseUploadsManagerProps) => {
  const { mutateAsync } = useUploadFileMutation();
  const [activeUploadsCount, setActiveUploadsCount] = useState(0);
  const CONCURRENCY_LIMIT = 3;

  const startUploads = useCallback(async () => {
    const queuedFiles = filesToUpload.filter(f => f.status === 'queued');
    if (queuedFiles.length === 0) return;

    // Update status to uploading for queued files
    setFilesToUpload(prev =>
      prev.map(f => (f.status === 'queued' ? { ...f, status: 'uploading' } : f))
    );

    const uploadQueue = [...queuedFiles];
    const activeUploadPromises: Promise<void>[] = [];

    const processQueue = async () => {
      while (uploadQueue.length > 0 && activeUploadPromises.length < CONCURRENCY_LIMIT) {
        const fileState = uploadQueue.shift();
        if (fileState) {
          setActiveUploadsCount(prev => prev + 1);

          const uploadPromise = mutateAsync({
            file: fileState.file,
            onProgress: (progress) => {
              setFilesToUpload(prev =>
                prev.map(f => (f.id === fileState.id ? { ...f, progress } : f))
              );
            },
          })
            .then((data) => {
              setFilesToUpload(prev =>
                prev.map(f => (f.id === fileState.id ? { ...f, status: 'uploaded', s3Location: data.Location } : f))
              );
              setUploadedFileNames(prev => {
                const s3Key = (fileState.file as any).webkitRelativePath || fileState.file.name;
                const newNames = [...new Set([...prev, s3Key])];
                localStorage.setItem('uploadedFileNames', JSON.stringify(newNames));
                return newNames;
              });
            })
            .catch((error) => {
              setFilesToUpload(prev =>
                prev.map(f => (f.id === fileState.id ? { ...f, status: 'failed', error: error.message } : f))
              );
            })
            .finally(() => {
              setActiveUploadsCount(prev => prev - 1);
              // Remove this promise from activeUploadPromises once it's done
              const index = activeUploadPromises.indexOf(uploadPromise);
              if (index > -1) {
                activeUploadPromises.splice(index, 1);
              }
              processQueue(); // Try to process next in queue
            });
          activeUploadPromises.push(uploadPromise);
        }
      }
    };

    processQueue(); // Start processing the queue
  }, [filesToUpload, setFilesToUpload, setUploadedFileNames, mutateAsync]);

  return { startUploads, activeUploadsCount };
};
