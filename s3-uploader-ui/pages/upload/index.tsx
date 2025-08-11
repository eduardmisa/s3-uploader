import React, { useState } from "react";
import { Button } from "@heroui/button";
import { cn } from "@heroui/theme";
import { UploadIcon } from "lucide-react";
import { Image } from "@heroui/image";
import { Card, CardBody, CardFooter, CardHeader } from "@heroui/card";
import { Progress } from "@heroui/progress";

import DefaultLayout from "@/layouts/default";
import { Dropzone } from "@/components/Dropzone";
import { FileUploadState } from "@/types";
import { useUploadsManager } from "@/hooks/useUploadsManager";
import { useSideNavBar } from "@/hooks/useSideNav";

export default function UploadPage() {
  const { pathHistory } = useSideNavBar();

  const [filesToUpload, setFilesToUpload] = useState<FileUploadState[]>([]);
  const [uploadedFileNames, setUploadedFileNames] = useState<string[]>(() => {
    // TODO: Figure out why this is failing...
    // // Initialize from local storage
    // const stored = window.localStorage?.getItem('uploadedFileNames');
    // return stored ? JSON.parse(stored) : [];
    return [];
  });

  const { startUploads, activeUploadsCount } = useUploadsManager({
    filesToUpload,
    setFilesToUpload,
    setUploadedFileNames,
    filePathPrefix: pathHistory.length > 0 ? pathHistory.join("/") : undefined,
  });

  const handleFilesDropped = (acceptedFiles: File[]) => {
    const newFiles: FileUploadState[] = acceptedFiles.map((file) => {
      const s3Key = (file as any).webkitRelativePath || file.name;
      const isAlreadyUploaded = uploadedFileNames.includes(s3Key);
      const isSkipped = isAlreadyUploaded;
      const isImage = file.type.startsWith("image/");

      return {
        id: `${s3Key}-${file.size}-${file.lastModified}`,
        file,
        status: isSkipped ? "skipped" : "queued",
        progress: 0,
        preview: isImage ? URL.createObjectURL(file) : undefined,
      };
    });

    setFilesToUpload((prev) => {
      // Filter out duplicates based on ID before adding
      const existingIds = new Set(prev.map((f) => f.id));
      const uniqueNewFiles = newFiles.filter((f) => !existingIds.has(f.id));

      return [...prev, ...uniqueNewFiles];
    });
  };

  const queued = filesToUpload.filter((f) => f.status === "queued");
  const uploading = filesToUpload.filter((f) => f.status === "uploading");
  const uploaded = filesToUpload.filter((f) => f.status === "uploaded");
  const failed = filesToUpload.filter((f) => f.status === "failed");
  // const skipped = filesToUpload.filter((f) => f.status === "skipped");

  const canUpload = uploading.length === 0 && queued.length > 0;

  const renderUploadStatusCardFooter = (fileList: FileUploadState[]) => {
    return (
      <CardFooter className="flex flex-col text-white/60 gap-4">
        <div className="flex flex-col w-full grow gap-2 items-center">
          {fileList.map((fileList, index) => (
            <div
              key={`${fileList.id}-${index}`}
              className="flex w-full items-center gap-2"
            >
              <Image
                alt="Breathing app icon"
                className="rounded-sm w-10 h-11 bg-black"
                src={fileList.preview}
              />
              <div className="flex flex-col w-full gap-2">
                <p className="text-tiny">{fileList.file.name}</p>
                <Progress
                  aria-label="Loading..."
                  className="max-w-md"
                  color={fileList.progress === 100 ? "success" : "primary"}
                  size="sm"
                  value={fileList.progress}
                />
              </div>
            </div>
          ))}
        </div>
      </CardFooter>
    );
  };

  return (
    <DefaultLayout>
      <section className="flex flex-row items-start justify-center gap-4 py-8 md:py-10 flex-wrap-reverse">
        <Card className="py-4">
          <CardHeader className="pb-0 pt-2 px-4 flex-col items-start">
            <p className="text-tiny uppercase font-bold">
              To upload{" "}
              <small className="text-default-500">
                {queued.length || 0} Files
              </small>
            </p>

            <h4 className="font-bold text-large">
              Uploading to{" "}
              <span className="underline">
                {pathHistory[pathHistory.length - 1] || "ROOT"}
              </span>{" "}
              folder
            </h4>
          </CardHeader>
          <CardBody className="overflow-visible py-2">
            <Dropzone onFilesDropped={handleFilesDropped} />

            <Button
              color={canUpload ? "success" : "default"}
              disabled={!canUpload}
              isLoading={activeUploadsCount > 0}
              variant={canUpload ? "shadow" : "faded"}
              onPress={startUploads}
            >
              {canUpload ? "Start Upload" : "Select/Drop files to upload"}{" "}
              <UploadIcon size={15} />
            </Button>
          </CardBody>

          {queued && queued.length > 0 && renderUploadStatusCardFooter(queued)}
          {uploading &&
            uploading.length > 0 &&
            renderUploadStatusCardFooter(uploading)}
          {uploaded &&
            uploaded.length > 0 &&
            renderUploadStatusCardFooter(uploaded)}
          {failed && failed.length > 0 && renderUploadStatusCardFooter(failed)}
        </Card>
      </section>
    </DefaultLayout>
  );
}

export const IconWrapper = ({ children, className }: any) => (
  <div
    className={cn(
      className,
      "flex items-center rounded-small justify-center w-7 h-7",
    )}
  >
    {children}
  </div>
);
