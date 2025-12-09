import { useState, useMemo } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardBody, CardFooter, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Progress } from "@heroui/progress";
import { Virtuoso } from "react-virtuoso";
import { Select, SelectItem } from "@heroui/select";
import AWS from "aws-sdk";

import DefaultLayout from "@/layouts/default";
import { useProcessImageThumbnailMutation } from "@/hooks/useProcessImageThumbnailMutation";
import { getThumbnailUrl } from "@/utils/urlUtil";

interface ThumbnailProcessFile {
  url: string;
  status: "pending" | "processing" | "success" | "failed";
  hasThumbnail: boolean;
  progress?: number;
  error?: string;
}

interface S3File {
  Key: string;
  LastModified: string;
  Size: number;
  ETag: string;
}

export default function ThumbnailsPage() {
  const [awsAccessKeyId, setAwsAccessKeyId] = useState("");
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState("");
  const [s3BucketName, setS3BucketName] = useState("emisa-pub-pictures");
  const [s3Region, setS3Region] = useState("ap-southeast-1");
  const [filesToProcess, setFilesToProcess] = useState<ThumbnailProcessFile[]>(
    [],
  );
  const [isLoadingS3Files, setIsLoadingS3Files] = useState(false);
  const [s3Files, setS3Files] = useState<S3File[]>([]);
  const [filter, setFilter] = useState<"all" | "hasThumbnail" | "noThumbnail">(
    "all",
  );

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

  const listAllS3Objects = async (): Promise<S3File[]> => {
    if (!s3) {
      throw new Error("AWS S3 not configured.");
    }
    let allS3Objects: S3File[] = [];
    let isTruncated = true;
    let ContinuationToken: string | undefined = undefined;

    while (isTruncated) {
      const params: AWS.S3.ListObjectsV2Request = {
        Bucket: s3BucketName,
        ContinuationToken: ContinuationToken,
      };
      const data = await s3.listObjectsV2(params).promise();

      if (data.Contents) {
        allS3Objects = allS3Objects.concat(
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

    return allS3Objects;
  };

  const processThumbnailMutation = useProcessImageThumbnailMutation();

  const isReadyToLoadS3 =
    awsAccessKeyId && awsSecretAccessKey && s3BucketName && s3Region;

  const handleLoadS3Files = async () => {
    if (!isReadyToLoadS3) {
      alert(
        "Please enter AWS Access Key ID, Secret Access Key, S3 Bucket Name, and S3 Region.",
      );

      return;
    }
    setIsLoadingS3Files(true);
    try {
      const allObjects = await listAllS3Objects();

      const imageFiles = allObjects.filter(
        (file) => !file.Key.startsWith("thumbnails/"),
      );

      const thumbnailKeys = new Set(
        allObjects
          .filter((file) => file.Key.startsWith("thumbnails/"))
          .map((file) => file.Key),
      );

      const tempUrl = `https://${s3BucketName}.s3.${s3Region}.amazonaws.com;`;

      const filesWithThumbnailStatus: ThumbnailProcessFile[] = imageFiles.map(
        (file) => {
          const thumbnailUrl = getThumbnailUrl(`${tempUrl}/${file.Key}`);
          const hasThumbnail = thumbnailUrl
            ? thumbnailKeys.has(thumbnailUrl.replace(`${tempUrl}/`, ""))
            : false;

          return { url: file.Key, status: "pending", hasThumbnail };
        },
      );

      setS3Files(imageFiles); // Keep track of original image files
      setFilesToProcess(filesWithThumbnailStatus);
    } catch (error) {
      console.error("Failed to load S3 files:", error);
      alert(
        "Failed to load S3 files. Check your credentials, bucket name, and region.",
      );
      setS3Files([]);
      setFilesToProcess([]);
    } finally {
      setIsLoadingS3Files(false);
    }
  };

  const handleProcessThumbnails = async () => {
    const filesToGenerate = filesToProcess.filter((file) => !file.hasThumbnail);

    if (filesToGenerate.length === 0) {
      alert("No files without thumbnails to process.");

      return;
    }

    setFilesToProcess((prev) =>
      prev.map((file) =>
        filesToGenerate.some((f) => f.url === file.url)
          ? { ...file, status: "processing" }
          : file,
      ),
    );

    const results = await processThumbnailMutation.mutateAsync({
      items: filesToGenerate.map((f) => ({ url: f.url })),
    });

    setFilesToProcess((prev) =>
      prev.map((file) => {
        const result = results.find((r) => r.url === file.url);

        return result
          ? {
              ...file,
              status: result.status as ThumbnailProcessFile["status"],
              error: result.error,
              hasThumbnail:
                result.status === "success" ? true : file.hasThumbnail,
            }
          : file;
      }),
    );
  };

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
              isDisabled={
                isLoadingS3Files || processThumbnailMutation.isPending
              }
              label="AWS Access Key ID"
              placeholder="Enter your AWS Access Key ID"
              type="password"
              value={awsAccessKeyId}
              onValueChange={setAwsAccessKeyId}
            />
            <Input
              isDisabled={
                isLoadingS3Files || processThumbnailMutation.isPending
              }
              label="AWS Secret Access Key"
              placeholder="Enter your AWS Secret Access Key"
              type="password"
              value={awsSecretAccessKey}
              onValueChange={setAwsSecretAccessKey}
            />
            <Input
              isDisabled={
                isLoadingS3Files || processThumbnailMutation.isPending
              }
              label="S3 Bucket Name"
              placeholder="Enter your S3 Bucket Name"
              value={s3BucketName}
              onValueChange={setS3BucketName}
            />
            <Input
              isDisabled={
                isLoadingS3Files || processThumbnailMutation.isPending
              }
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
              isDisabled={
                !isReadyToLoadS3 ||
                isLoadingS3Files ||
                processThumbnailMutation.isPending
              }
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
            <Button
              className="w-full"
              isDisabled={
                filesToProcess.filter((file) => !file.hasThumbnail).length ===
                  0 || processThumbnailMutation.isPending
              }
              isLoading={processThumbnailMutation.isPending}
              onPress={handleProcessThumbnails}
            >
              Process Missing Thumbnails
            </Button>
          </CardFooter>
        </Card>

        {filesToProcess.length > 0 && (
          <Card className="w-[50dvw]">
            <CardHeader className="flex-col items-start">
              <p className="uppercase font-bold mx-auto">Files to Process</p>
            </CardHeader>
            <Divider />
            <CardBody className="overflow-visible py-2 gap-y-4 py-8">
              <Select
                label="Filter by thumbnail status"
                renderValue={(items) => {
                  const selectedItem = Array.from(items)[0];

                  if (!selectedItem) return "Select a filter";
                  switch (selectedItem.key) {
                    case "all":
                      return `All (${filesToProcess.length})`;
                    case "hasThumbnail":
                      return `Has Thumbnail (${filesToProcess.filter((file) => file.hasThumbnail).length})`;
                    case "noThumbnail":
                      return `No Thumbnail (${filesToProcess.filter((file) => !file.hasThumbnail).length})`;
                    default:
                      return "Select a filter";
                  }
                }}
                selectedKeys={new Set([filter])}
                onSelectionChange={(keys) => {
                  const selectedKey = Array.from(keys)[0];

                  if (typeof selectedKey === "string") {
                    setFilter(
                      selectedKey as "all" | "hasThumbnail" | "noThumbnail",
                    );
                  }
                }}
              >
                <SelectItem key="all">All ({filesToProcess.length})</SelectItem>
                <SelectItem key="hasThumbnail">
                  Has Thumbnail (
                  {filesToProcess.filter((file) => file.hasThumbnail).length})
                </SelectItem>
                <SelectItem key="noThumbnail">
                  No Thumbnail (
                  {filesToProcess.filter((file) => !file.hasThumbnail).length})
                </SelectItem>
              </Select>
              <ul className="space-y-2 overflow-y-auto h-[560px]">
                <Virtuoso
                  data={filesToProcess.filter((file) => {
                    if (filter === "hasThumbnail") {
                      return file.hasThumbnail;
                    }
                    if (filter === "noThumbnail") {
                      return !file.hasThumbnail;
                    }

                    return true;
                  })}
                  itemContent={(index, file) => (
                    <li
                      key={index}
                      className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-md w-full mb-2"
                    >
                      <span
                        className={`font-bold text-sm ${file.status === "pending" ? "text-gray-500" : file.status === "processing" ? "text-blue-500" : file.status === "success" ? "text-green-500" : "text-red-500"} w-24 flex-shrink-0 flex items-center gap-1`}
                      >
                        {file.status.toUpperCase()}
                      </span>
                      <span className="text-gray-700 dark:text-gray-200 text-sm truncate flex-grow">
                        {file.url}
                      </span>
                      {file.hasThumbnail && (
                        <span className="text-green-500 text-xs">
                          (Thumbnail Exists)
                        </span>
                      )}
                      {file.status === "processing" && (
                        <div className="flex flex-row w-md items-center gap-x-2">
                          <Progress
                            aria-label="Processing..."
                            className="max-w-md"
                            color="primary"
                            size="sm"
                            value={file.progress || 0}
                          />
                          <span className="text-xs text-primary flex-shrink-0">
                            {file.progress ? file.progress.toFixed(0) : 0}%
                          </span>
                        </div>
                      )}
                      {file.error && (
                        <span className="text-red-500 text-sm">
                          Error: {file.error}
                        </span>
                      )}
                    </li>
                  )}
                />
              </ul>
            </CardBody>
            <CardFooter />
          </Card>
        )}
      </section>
    </DefaultLayout>
  );
}
