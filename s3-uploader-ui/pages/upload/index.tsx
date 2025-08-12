import React, { useState } from "react";
import { Button } from "@heroui/button";
import { cn } from "@heroui/theme";
import { UploadIcon } from "lucide-react";
import { Image } from "@heroui/image";
import { Card, CardBody, CardFooter, CardHeader } from "@heroui/card";
import { Progress } from "@heroui/progress";
import { Virtuoso } from "react-virtuoso";

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

  const renderStatusCard = (title: string, fileList: FileUploadState[]) => {
    return (
      <Card className="py-4">
        <CardHeader className="pb-0 pt-2 px-4 flex-col items-start">
          <p className="text-tiny uppercase font-bold">
            {title} <small className="text-default-500">{fileList.length} Files</small>
          </p>
        </CardHeader>
        <CardBody className="overflow-visible py-2">
          {/* Fixed-height scroll area so Virtuoso can virtualize */}
          <div style={{ height: 320 }}>
            <Virtuoso
              data={fileList}
              itemContent={(index, f) => (
                <div key={f.id} className="flex w-full items-center gap-2 p-2">
                  <Image
                    alt={f.file.name}
                    className="rounded-sm w-10 h-11 bg-black"
                    src={f.preview}
                  />
                  <div className="flex flex-col w-full gap-2">
                    <p className="text-tiny">{f.file.name}</p>
                    <Progress
                      aria-label="Loading..."
                      className="max-w-md"
                      color={f.progress === 100 ? "success" : "primary"}
                      size="sm"
                      value={f.progress}
                    />
                  </div>
                </div>
              )}
            />
          </div>
        </CardBody>
      </Card>
    );
  };

  return (
    <DefaultLayout>
      <section className="flex flex-row items-start justify-center gap-4 py-8 md:py-10 flex-wrap-reverse">
        <div className="flex flex-col gap-4 w-full max-w-4xl">
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
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {queued && queued.length > 0 && renderStatusCard("Queued", queued)}
            {uploading && uploading.length > 0 && renderStatusCard("Uploading", uploading)}
            {uploaded && uploaded.length > 0 && renderStatusCard("Uploaded", uploaded)}
            {failed && failed.length > 0 && renderStatusCard("Failed", failed)}
          </div>
        </div>
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
