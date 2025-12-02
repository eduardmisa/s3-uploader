import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Progress } from "@heroui/progress";
import AWS from "aws-sdk";
import { Card, CardBody, CardFooter, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Virtuoso } from "react-virtuoso";

import DefaultLayout from "@/layouts/default";

interface LocalFile {
  path: string;
  size: number;
  lastModified: Date;
  file: File;
}

interface S3File {
  Key: string;
  LastModified: string;
  Size: number;
  ETag: string;
}

interface SyncFile {
  path: string;
  status: "new" | "modified" | "skipped" | "uploading" | "uploaded";
  localFile?: LocalFile;
  s3File?: S3File;
  progress?: number; // 0-100 for upload progress
}

export default function SyncPage() {
  const [awsAccessKeyId, setAwsAccessKeyId] = useState("");
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState("");
  const [s3BucketName, setS3BucketName] = useState("emisa-pub-pictures");
  const [s3Region, setS3Region] = useState("ap-southeast-1");
  const [selectedLocalFiles, setSelectedLocalFiles] = useState<File[]>([]);
  const [syncFiles, setSyncFiles] = useState<SyncFile[]>([]);
  const [isLoadingS3Files, setIsLoadingS3Files] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [s3Files, setS3Files] = useState<S3File[]>([]);
  const [activeUploadRequests, setActiveUploadRequests] = useState<
    Map<string, AWS.S3.ManagedUpload>
  >(new Map());
  const cancelUploadRef = useRef(false);

  const s3 = useMemo(() => {
    if (awsAccessKeyId && awsSecretAccessKey && s3Region) {
      return new AWS.S3({
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
        region: s3Region,
      });
    }

    return null;
  }, [awsAccessKeyId, awsSecretAccessKey, s3Region]);

  const listS3Files = async (): Promise<S3File[]> => {
    if (!s3) {
      throw new Error("AWS S3 not configured.");
    }
    let allS3Files: S3File[] = [];
    let isTruncated = true;
    let ContinuationToken: string | undefined = undefined;

    while (isTruncated) {
      const params: AWS.S3.ListObjectsV2Request = {
        Bucket: s3BucketName,
        ContinuationToken: ContinuationToken,
      };
      const data = await s3.listObjectsV2(params).promise();

      if (data.Contents) {
        allS3Files = allS3Files.concat(
          data.Contents?.map((s3Object) => ({
            Key: s3Object.Key || "",
            LastModified: s3Object.LastModified?.toISOString() || "",
            Size: s3Object.Size || 0,
            ETag: s3Object.ETag || "",
          })) || [],
        );
      }
      isTruncated = data.IsTruncated || false;
      ContinuationToken = data.NextContinuationToken;
    }

    return allS3Files;
  };

  useEffect(() => {
    if (selectedLocalFiles.length === 0) {
      setSyncFiles([]);

      return;
    }

    const localFilesMap = new Map<string, LocalFile>();

    selectedLocalFiles.forEach((file: File) => {
      const relativePath = file.webkitRelativePath || file.name;

      localFilesMap.set(relativePath, {
        path: relativePath,
        size: file.size,
        lastModified: new Date(file.lastModified),
        file: file,
      });
    });

    const s3FilesMap = new Map<string, S3File>();

    s3Files.forEach((file) => {
      if (file.Key) {
        s3FilesMap.set(file.Key, file);
      }
    });

    const filesToSync: SyncFile[] = [];

    localFilesMap.forEach((localFile, path) => {
      const s3File = s3FilesMap.get(path);

      if (!s3File) {
        filesToSync.push({ path, status: "new", localFile });
      } else {
        const s3LastModified = new Date(s3File.LastModified);

        // Only mark as modified if size or last modified date is different
        if (
          localFile.size !== s3File.Size ||
          localFile.lastModified > s3LastModified
        ) {
          filesToSync.push({ path, status: "modified", localFile, s3File });
        } else {
          filesToSync.push({ path, status: "skipped", localFile, s3File });
        }
      }
    });

    setSyncFiles(filesToSync);
  }, [selectedLocalFiles, s3Files]);

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);

      setSelectedLocalFiles((prevFiles) => {
        // Filter out duplicates based on webkitRelativePath to avoid issues if the same file is selected again
        const existingPaths = new Set(
          prevFiles.map((f) => f.webkitRelativePath || f.name),
        );
        const uniqueNewFiles = newFiles.filter(
          (f) => !existingPaths.has(f.webkitRelativePath || f.name),
        );

        return [...prevFiles, ...uniqueNewFiles];
      });
      setSyncFiles([]); // Clear previous sync files to re-evaluate with new selection
      event.target.value = ""; // Reset the input value to allow selecting the same folder again
    }
  };

  const handleLoadS3Files = async () => {
    if (!awsAccessKeyId || !awsSecretAccessKey || !s3BucketName || !s3Region) {
      alert(
        "Please enter AWS Access Key ID, Secret Access Key, S3 Bucket Name, and S3 Region.",
      );

      return;
    }
    setIsLoadingS3Files(true);
    try {
      const files = await listS3Files();

      setS3Files(files);
    } catch (error) {
      console.error("Failed to load S3 files:", error);
      alert(
        "Failed to load S3 files. Check your credentials, bucket name, and region.",
      );
      setS3Files([]);
    } finally {
      setIsLoadingS3Files(false);
    }
  };

  const uploadFilesToS3 = async () => {
    if (!s3) {
      alert("AWS S3 not configured. Please provide credentials.");

      return;
    }
    setIsUploading(true);
    cancelUploadRef.current = false; // Reset cancellation flag at the start of upload
    let filesToProcess = syncFiles.filter(
      (f) => f.status === "new" || f.status === "modified",
    );
    let processedCount = 0;

    for (const file of filesToProcess) {
      // Check for cancellation before starting each upload
      if (cancelUploadRef.current) {
        console.log("Uploads cancelled by user. Stopping further processing.");
        break;
      }
      try {
        if (file.localFile) {
          const uploadRequest = s3.upload({
            Bucket: s3BucketName,
            Key: file.path,
            Body: file.localFile.file,
          });

          setActiveUploadRequests((prev) =>
            new Map(prev).set(file.path, uploadRequest),
          );

          uploadRequest.on("httpUploadProgress", (progress) => {
            setSyncFiles((prev) =>
              prev.map((f) =>
                f.path === file.path
                  ? { ...f, progress: (progress.loaded / progress.total) * 100 }
                  : f,
              ),
            );
          });

          await uploadRequest.promise();

          setActiveUploadRequests((prev) => {
            const newMap = new Map(prev);

            newMap.delete(file.path);

            return newMap;
          });

          setSyncFiles((prev) =>
            prev.map((f) =>
              f.path === file.path
                ? { ...f, status: "uploaded", progress: 100 }
                : f,
            ),
          );
        }
        processedCount++;
      } catch (error: any) {
        if (error.code === "RequestAbortedError") {
          console.log(`Upload for ${file.path} was aborted by the user.`);
          setSyncFiles((prev) =>
            prev.map((f) =>
              f.path === file.path
                ? { ...f, status: "skipped", progress: 0 }
                : f,
            ),
          );
        } else {
          console.error(`Failed to upload file ${file.path}:`, error);
          // Optionally, update file status to 'failed'
        }
      }
    }
    setIsUploading(false);
    cancelUploadRef.current = false; // Reset cancellation flag at the end of upload
    alert(`Upload complete! Processed ${processedCount} files.`);
    handleLoadS3Files(); // Reload S3 files to reflect changes
  };

  const handleCancelUpload = () => {
    activeUploadRequests.forEach((upload, path) => {
      if (upload && typeof upload.abort === "function") {
        upload.abort();
        setSyncFiles((prev) =>
          prev.map((f) =>
            f.path === path ? { ...f, status: "skipped", progress: 0 } : f,
          ),
        );
      } else {
        console.warn(
          `Could not abort upload for ${path}: request object invalid or abort method missing.`,
        );
      }
    });
    setActiveUploadRequests(new Map());
    setIsUploading(false);
    cancelUploadRef.current = true; // Signal to stop further uploads
    alert("Uploads cancelled.");
  };

  const handleUpload = () => {
    if (selectedLocalFiles.length > 0 && syncFiles.length > 0) {
      console.log("Starting upload...");
      uploadFilesToS3();
    }
  };

  const isReadyToLoadS3 =
    awsAccessKeyId && awsSecretAccessKey && s3BucketName && s3Region;
  const isReadyToUpload =
    selectedLocalFiles.length > 0 &&
    !isLoadingS3Files &&
    syncFiles.some((f) => f.status === "new" || f.status === "modified") &&
    !isUploading;

  return (
    <DefaultLayout>
      <section className="flex items-start gap-8">
        <Card>
          <CardHeader className="flex-col items-start">
            <p className="uppercase font-bold mx-auto">AWS Configuration</p>
          </CardHeader>
          <Divider />
          <CardBody className="overflow-visible py-2 gap-y-4 py-8">
            <Input
              isDisabled={isUploading || isLoadingS3Files}
              label="AWS Access Key ID"
              placeholder="Enter your AWS Access Key ID"
              type="password"
              value={awsAccessKeyId}
              onValueChange={setAwsAccessKeyId}
            />
            <Input
              isDisabled={isUploading || isLoadingS3Files}
              label="AWS Secret Access Key"
              placeholder="Enter your AWS Secret Access Key"
              type="password"
              value={awsSecretAccessKey}
              onValueChange={setAwsSecretAccessKey}
            />
            <Input
              isDisabled={isUploading || isLoadingS3Files}
              label="S3 Bucket Name"
              placeholder="Enter your S3 Bucket Name"
              value={s3BucketName}
              onValueChange={setS3BucketName}
            />
            <Input
              isDisabled={isUploading || isLoadingS3Files}
              label="S3 Region"
              placeholder="e.g., us-east-1"
              value={s3Region}
              onValueChange={setS3Region}
            />
          </CardBody>
          <Divider />
          <CardFooter className="flex flex-col gap-y-4">
            <Button
              className="w-full"
              isDisabled={!isReadyToLoadS3 || isLoadingS3Files || isUploading}
              isLoading={isLoadingS3Files}
              onPress={handleLoadS3Files}
            >
              Load S3 Files
              {s3Files.length > 0 && (
                <span className="text-success">
                  {" "}
                  - ({s3Files.length} files)
                </span>
              )}
            </Button>
            <input
              multiple
              className="hidden"
              id="folder-input"
              onChange={handleFileSelection}
              type="file"
              // @ts-ignore
              webkitdirectory="true"
            />
            <Button
              className="w-full"
              isDisabled={isUploading || isLoadingS3Files}
              onPress={() => document.getElementById("folder-input")?.click()}
            >
              Select Folder(s) to Upload{" "}
              {selectedLocalFiles.length > 0 && !isLoadingS3Files && (
                <span className="text-success">
                  {" "}
                  - ({selectedLocalFiles.length} files)
                </span>
              )}
            </Button>
            {isLoadingS3Files && (
              <p className="text-gray-600 dark:text-gray-300 mx-auto">
                Loading S3 files...
              </p>
            )}
          </CardFooter>
        </Card>

        {selectedLocalFiles.length > 0 && !isLoadingS3Files && (
          <Card className="w-[50dvw]">
            <CardHeader className="flex-col items-start">
              <p className="uppercase font-bold mx-auto">Files to upload</p>
            </CardHeader>
            <Divider />
            <CardBody className="overflow-visible py-2 gap-y-4 py-8">
              <div className="flex">
                <Button
                  isDisabled={!isReadyToUpload || isUploading}
                  isLoading={isUploading}
                  onPress={handleUpload}
                >
                  {isUploading ? "Uploading..." : "Start Upload"}
                </Button>
                {isUploading && (
                  <Button
                    className="ml-auto"
                    color="danger"
                    variant="flat"
                    onPress={handleCancelUpload}
                  >
                    Cancel Upload
                  </Button>
                )}
              </div>
              <ul className="space-y-2 overflow-y-auto h-[560px]">
                {/* Fixed-height scroll area so Virtuoso can virtualize */}
                <Virtuoso
                  data={syncFiles}
                  itemContent={(index, file) => (
                    <li
                      key={index}
                      className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-md w-full mb-2"
                    >
                      <span
                        className={`font-bold text-sm ${file.status === "new" ? "text-green-500" : file.status === "modified" ? "text-yellow-500" : file.status === "skipped" ? "text-gray-500" : "text-blue-500"} w-24 flex-shrink-0 flex items-center gap-1`}
                      >
                        {file.status === "new" && (
                          <span className="text-green-500">▲</span>
                        )}
                        {file.status === "modified" && (
                          <span className="text-yellow-500">●</span>
                        )}
                        {file.status === "skipped" && (
                          <span className="text-gray-500">━</span>
                        )}
                        {file.status === "uploaded" && (
                          <span className="text-blue-500">✔</span>
                        )}
                        {file.status === "uploading" && (
                          <span className="text-blue-500">...</span>
                        )}
                        {file.status.toUpperCase()}
                      </span>
                      <span className="text-gray-700 dark:text-gray-200 text-sm truncate flex-grow">
                        {file.path}
                      </span>
                      {file.progress !== undefined && file.progress < 100 && (
                        <div className="flex flex-row w-md items-center gap-x-2">
                          <Progress
                            aria-label="Uploading..."
                            className="max-w-md"
                            color="success"
                            size="sm"
                            value={file.progress}
                          />
                          <span className="text-xs text-success flex-shrink-0">
                            {file.progress.toFixed(0)}%
                          </span>
                        </div>
                      )}
                    </li>
                  )}
                />
                {/* 
                {syncFiles.map((file, index) => (
                  <li key={index} className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-md">
                    <span className={`font-bold text-sm ${file.status === "new" ? "text-green-500" : file.status === "modified" ? "text-yellow-500" : file.status === "skipped" ? "text-gray-500" : "text-blue-500"} w-24 flex-shrink-0 flex items-center gap-1`}>
                      {file.status === "new" && <span className="text-green-500">▲</span>}
                      {file.status === "modified" && <span className="text-yellow-500">●</span>}
                      {file.status === "skipped" && <span className="text-gray-500">━</span>}
                      {file.status === "uploaded" && <span className="text-blue-500">✔</span>}
                      {file.status === "uploading" && <span className="text-blue-500">...</span>}
                      {file.status.toUpperCase()}
                    </span>
                    <span className="text-gray-700 dark:text-gray-200 text-sm truncate flex-grow">{file.path}</span>
                    {file.progress !== undefined && file.progress < 100 && (
                      <span className="text-sm text-blue-500 flex-shrink-0">({file.progress.toFixed(0)}%)</span>
                    )}
                  </li>
                ))} */}
              </ul>
            </CardBody>
            <CardFooter />
          </Card>
        )}
      </section>
    </DefaultLayout>
  );
}
