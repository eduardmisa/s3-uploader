import { Button } from "@heroui/button";
import { Card } from "@heroui/card";
import { Checkbox } from "@heroui/checkbox";
import { Progress } from "@heroui/progress";
import { useInfiniteQuery, InfiniteData } from "@tanstack/react-query";
import { useState } from "react";

import { Dropzone } from "@/components/Dropzone";
import { title } from "@/components/primitives";
import { useUploadsManager } from "@/hooks/useUploadsManager";
import DefaultLayout from "@/layouts/default";
import { ListFilesResult, listFilesFromS3 } from "@/lib/aws-s3";
import { FileUploadState } from "@/types";

const DEFAULT_IMAGE = "/file-image.png"; // Default image for previews

export default function BrowsePage() {
  const [filesToUpload, setFilesToUpload] = useState<FileUploadState[]>([]);
  const [uploadedFileNames, setUploadedFileNames] = useState<string[]>(() => {
    // // Initialize from local storage
    // const stored = localStorage.getItem('uploadedFileNames');
    // return stored ? JSON.parse(stored) : [];
    return [];
  });
  const [overrideExistingFiles, setOverrideExistingFiles] = useState(false); // New state for override option

  // States for collapsible cards
  const [isSkippedCollapsed, setIsSkippedCollapsed] = useState(false);
  const [isUploadingCollapsed, setIsUploadingCollapsed] = useState(false);
  const [isQueuedCollapsed, setIsQueuedCollapsed] = useState(false);
  const [isFailedCollapsed, setIsFailedCollapsed] = useState(false);
  const [isUploadedCollapsed, setIsUploadedCollapsed] = useState(false);

  // React Query for S3 image gallery
  const {
    data: s3FileData,
    isLoading: isFilesLoading,
    isError: isFilesError,
    error: galleryError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<
    ListFilesResult,
    Error,
    InfiniteData<ListFilesResult>,
    string[],
    string | undefined
  >({
    queryKey: ["s3Files"],
    queryFn: ({ pageParam }) => listFilesFromS3(),
    initialPageParam: undefined, // Start with no continuation token
    getNextPageParam: (lastPage: ListFilesResult) =>
      lastPage.nextContinuationToken, // Explicitly type lastPage
  });

  const s3FileUrls =
    s3FileData?.pages.flatMap((page: ListFilesResult) => page.fileUrls) || []; // Flatten all pages for display, explicitly type page

  // States for pagination
  const ITEMS_PER_PAGE = 10;
  const [skippedCurrentPage, setSkippedCurrentPage] = useState(1);
  const [uploadingCurrentPage, setUploadingCurrentPage] = useState(1);
  const [queuedCurrentPage, setQueuedCurrentPage] = useState(1);
  const [failedCurrentPage, setFailedCurrentPage] = useState(1);
  const [uploadedCurrentPage, setUploadedCurrentPage] = useState(1);
  // Removed galleryCurrentPage as useInfiniteQuery manages pages internally

  // Use the custom hook for managing uploads
  const { startUploads } = useUploadsManager({
    filesToUpload,
    setFilesToUpload,
    setUploadedFileNames,
  });

  // Clean up object URLs when component unmounts
  // This is a basic cleanup, more robust solutions might involve tracking all URLs
  // and revoking them when files are removed from the list or app unmounts.
  // For simplicity, we'll rely on browser's garbage collection for now,
  // but for a production app, explicit revokeObjectURL is recommended.
  // No longer needed as useInfiniteQuery handles fetching and caching.

  const handleFilesDropped = (acceptedFiles: File[]) => {
    const newFiles: FileUploadState[] = acceptedFiles.map((file) => {
      const s3Key = (file as any).webkitRelativePath || file.name; // Get the S3 key including path
      const isAlreadyUploaded = uploadedFileNames.includes(s3Key); // Check against S3 key
      const isSkipped = isAlreadyUploaded && !overrideExistingFiles; // Skip only if not overriding
      const isImage = file.type.startsWith("image/");

      return {
        id: `${s3Key}-${file.size}-${file.lastModified}`, // Unique ID based on S3 key
        file,
        status: isSkipped ? "skipped" : "queued",
        progress: 0,
        preview: isImage ? URL.createObjectURL(file) : undefined, // Generate preview for images
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
  const skipped = filesToUpload.filter((f) => f.status === "skipped");

  return (
    <DefaultLayout>
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div className="inline-block max-w-lg text-center justify-center">
          <h1 className={title()}>Browse</h1>
        </div>
      </section>
      <section>
        <Section>
          <Section>
            <Flex justify={"center"}>
              <Container size="4">
                <Flex direction="column" gap="4">
                  <Card style={{ width: "100%" }}>
                    <Heading align="center" as="h1" size="8">
                      File Uploader
                    </Heading>
                    <Flex align="center" direction="column" gap="3">
                      <Text as="div" mb="2" size="2">
                        Drag and drop files here, or click to select files.
                      </Text>
                      <Dropzone onFilesDropped={handleFilesDropped} />
                      <Flex
                        align="center"
                        direction={"column"}
                        gapY={"3"}
                        justify="between"
                      >
                        <label
                          htmlFor="checkboxOverride"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          <Checkbox
                            checked={overrideExistingFiles}
                            id="checkboxOverride"
                            onValueChange={(checked) =>
                              setOverrideExistingFiles(checked as boolean)
                            }
                          />
                          <Text size="2">Override existing files</Text>
                        </label>
                        <Button
                          disabled={queued.length === 0}
                          variant="solid"
                          onPress={startUploads}
                        >
                          Start Uploads ({queued.length} queued)
                        </Button>
                      </Flex>
                    </Flex>
                  </Card>

                  {skipped.length > 0 && (
                    <Card style={{ width: "100%" }}>
                      <Flex align="center" justify="between" mb="2">
                        <Flex align="center" gap="2">
                          <Heading size="4">
                            Skipped Files ({skipped.length})
                          </Heading>
                          <Button
                            variant="ghost"
                            onPress={() =>
                              setIsSkippedCollapsed(!isSkippedCollapsed)
                            }
                          >
                            {isSkippedCollapsed ? "Show" : "Hide"}
                          </Button>
                        </Flex>
                        <Button
                          onPress={() => {
                            setFilesToUpload((prev) =>
                              prev.map((f) =>
                                f.status === "skipped"
                                  ? { ...f, status: "queued" }
                                  : f,
                              ),
                            );
                          }}
                        >
                          Upload Skipped
                        </Button>
                      </Flex>
                      {!isSkippedCollapsed && (
                        <>
                          <Flex
                            direction="column"
                            gap="2"
                            style={{ minHeight: "100px" }}
                          >
                            {" "}
                            {/* Changed to min-height, removed overflow */}
                            {skipped
                              .slice(
                                (skippedCurrentPage - 1) * ITEMS_PER_PAGE,
                                skippedCurrentPage * ITEMS_PER_PAGE,
                              )
                              .map((fileState) => (
                                <Flex
                                  key={fileState.id}
                                  align="center"
                                  className="file-item-enter"
                                  gap="2"
                                >
                                  <Image
                                    alt="preview"
                                    src={fileState.preview || DEFAULT_IMAGE}
                                    style={{
                                      width: 24,
                                      height: 24,
                                      objectFit: "cover",
                                      borderRadius: 4,
                                    }}
                                  />
                                  <Text color="gray" size="2">
                                    {fileState.file.name} - Already uploaded
                                  </Text>
                                </Flex>
                              ))}
                          </Flex>
                          {skipped.length > ITEMS_PER_PAGE && (
                            <Pagination
                              currentPage={skippedCurrentPage}
                              totalPages={Math.ceil(
                                skipped.length / ITEMS_PER_PAGE,
                              )}
                              onPageChange={setSkippedCurrentPage}
                            />
                          )}
                        </>
                      )}
                    </Card>
                  )}

                  {uploading.length > 0 && (
                    <Card style={{ width: "100%" }}>
                      <Flex align="center" justify="between" mb="2">
                        <Flex align="center" gap="2">
                          <Heading size="4">
                            Uploading ({uploading.length})
                          </Heading>
                          <Button
                            variant="ghost"
                            onPress={() =>
                              setIsUploadingCollapsed(!isUploadingCollapsed)
                            }
                          >
                            {isUploadingCollapsed ? "Show" : "Hide"}
                          </Button>
                        </Flex>
                      </Flex>
                      {!isUploadingCollapsed && (
                        <>
                          <Flex
                            direction="column"
                            gap="2"
                            style={{ minHeight: "100px" }}
                          >
                            {" "}
                            {/* Changed to min-height, removed overflow */}
                            {uploading
                              .slice(
                                (uploadingCurrentPage - 1) * ITEMS_PER_PAGE,
                                uploadingCurrentPage * ITEMS_PER_PAGE,
                              )
                              .map((fileState) => (
                                <Flex
                                  key={fileState.id}
                                  align="center"
                                  className="file-item-enter"
                                  gap="2"
                                >
                                  <Image
                                    alt="preview"
                                    src={fileState.preview || DEFAULT_IMAGE}
                                    style={{
                                      width: 24,
                                      height: 24,
                                      objectFit: "cover",
                                      borderRadius: 4,
                                    }}
                                  />
                                  <Box>
                                    <Text size="2">{fileState.file.name}</Text>
                                    <Progress value={fileState.progress} />
                                  </Box>
                                </Flex>
                              ))}
                          </Flex>
                          {uploading.length > ITEMS_PER_PAGE && (
                            <Pagination
                              currentPage={uploadingCurrentPage}
                              totalPages={Math.ceil(
                                uploading.length / ITEMS_PER_PAGE,
                              )}
                              onPageChange={setUploadingCurrentPage}
                            />
                          )}
                        </>
                      )}
                    </Card>
                  )}

                  {queued.length > 0 && (
                    <Card style={{ width: "100%" }}>
                      <Flex align="center" justify="between" mb="2">
                        <Flex align="center" gap="2">
                          <Heading size="4">Queued ({queued.length})</Heading>
                          <Button
                            variant="ghost"
                            onPress={() =>
                              setIsQueuedCollapsed(!isQueuedCollapsed)
                            }
                          >
                            {isQueuedCollapsed ? "Show" : "Hide"}
                          </Button>
                        </Flex>
                      </Flex>
                      {!isQueuedCollapsed && (
                        <>
                          <Flex
                            direction="column"
                            gap="2"
                            style={{ minHeight: "100px" }}
                          >
                            {" "}
                            {/* Changed to min-height, removed overflow */}
                            {queued
                              .slice(
                                (queuedCurrentPage - 1) * ITEMS_PER_PAGE,
                                queuedCurrentPage * ITEMS_PER_PAGE,
                              )
                              .map((fileState) => (
                                <Flex
                                  key={fileState.id}
                                  align="center"
                                  className="file-item-enter"
                                  gap="2"
                                >
                                  <Image
                                    alt="preview"
                                    src={fileState.preview || DEFAULT_IMAGE}
                                    style={{
                                      width: 24,
                                      height: 24,
                                      objectFit: "cover",
                                      borderRadius: 4,
                                    }}
                                  />
                                  <Text size="2">{fileState.file.name}</Text>
                                </Flex>
                              ))}
                          </Flex>
                          {queued.length > ITEMS_PER_PAGE && (
                            <Pagination
                              currentPage={queuedCurrentPage}
                              totalPages={Math.ceil(
                                queued.length / ITEMS_PER_PAGE,
                              )}
                              onPageChange={setQueuedCurrentPage}
                            />
                          )}
                        </>
                      )}
                    </Card>
                  )}

                  {failed.length > 0 && (
                    <Card style={{ width: "100%" }}>
                      <Flex align="center" justify="between" mb="2">
                        <Flex align="center" gap="2">
                          <Heading color="red" size="4">
                            Failed ({failed.length})
                          </Heading>
                          <Button
                            variant="ghost"
                            onPress={() =>
                              setIsFailedCollapsed(!isFailedCollapsed)
                            }
                          >
                            {isFailedCollapsed ? "Show" : "Hide"}
                          </Button>
                        </Flex>
                      </Flex>
                      {!isFailedCollapsed && (
                        <>
                          <Flex
                            direction="column"
                            gap="2"
                            style={{ minHeight: "100px" }}
                          >
                            {" "}
                            {/* Changed to min-height, removed overflow */}
                            {failed
                              .slice(
                                (failedCurrentPage - 1) * ITEMS_PER_PAGE,
                                failedCurrentPage * ITEMS_PER_PAGE,
                              )
                              .map((fileState) => (
                                <Flex
                                  key={fileState.id}
                                  align="center"
                                  className="file-item-enter"
                                  gap="2"
                                >
                                  <Image
                                    alt="preview"
                                    src={fileState.preview || DEFAULT_IMAGE}
                                    style={{
                                      width: 24,
                                      height: 24,
                                      objectFit: "cover",
                                      borderRadius: 4,
                                    }}
                                  />
                                  <Text color="red" size="2">
                                    {fileState.file.name} -{" "}
                                    {fileState.error || "Unknown error"}
                                  </Text>
                                </Flex>
                              ))}
                          </Flex>
                          {failed.length > ITEMS_PER_PAGE && (
                            <Pagination
                              currentPage={failedCurrentPage}
                              totalPages={Math.ceil(
                                failed.length / ITEMS_PER_PAGE,
                              )}
                              onPageChange={setFailedCurrentPage}
                            />
                          )}
                        </>
                      )}
                    </Card>
                  )}

                  {uploaded.length > 0 && (
                    <Card style={{ width: "100%" }}>
                      <Flex align="center" justify="between" mb="2">
                        <Flex align="center" gap="2">
                          <Heading size="4">
                            Uploaded ({uploaded.length})
                          </Heading>
                          <Button
                            variant="ghost"
                            onPress={() =>
                              setIsUploadedCollapsed(!isUploadedCollapsed)
                            }
                          >
                            {isUploadedCollapsed ? "Show" : "Hide"}
                          </Button>
                        </Flex>
                      </Flex>
                      {!isUploadedCollapsed && (
                        <>
                          <Flex
                            direction="column"
                            gap="2"
                            style={{ minHeight: "100px" }}
                          >
                            {" "}
                            {/* Changed to min-height, removed overflow */}
                            {uploaded
                              .slice(
                                (uploadedCurrentPage - 1) * ITEMS_PER_PAGE,
                                uploadedCurrentPage * ITEMS_PER_PAGE,
                              )
                              .map((fileState) => (
                                <Flex
                                  key={fileState.id}
                                  align="center"
                                  className="file-item-enter"
                                  gap="2"
                                >
                                  <Image
                                    alt="preview"
                                    src={fileState.preview || DEFAULT_IMAGE}
                                    style={{
                                      width: 24,
                                      height: 24,
                                      objectFit: "cover",
                                      borderRadius: 4,
                                    }}
                                  />
                                  <Text color="green" size="2">
                                    {fileState.file.name} - Uploaded
                                  </Text>
                                </Flex>
                              ))}
                          </Flex>
                          {uploaded.length > ITEMS_PER_PAGE && (
                            <Pagination
                              currentPage={uploadedCurrentPage}
                              totalPages={Math.ceil(
                                uploaded.length / ITEMS_PER_PAGE,
                              )}
                              onPageChange={setUploadedCurrentPage}
                            />
                          )}
                        </>
                      )}
                    </Card>
                  )}
                </Flex>
              </Container>
            </Flex>
          </Section>
          {!isFilesLoading &&
            !isFilesError &&
            s3FileData &&
            s3FileData.pages.length > 0 && (
              <Section>
                <Flex justify={"center"}>
                  <Card>
                    <Heading align="center" as="h1" size="8">
                      Gallery
                    </Heading>
                    <br />
                    {isFilesLoading && (
                      <Text align="center">Loading images...</Text>
                    )}
                    {isFilesError && (
                      <Text align="center" color="red">
                        {(galleryError as any)?.message ||
                          "Failed to load images from S3."}
                      </Text>
                    )}
                    {!isFilesLoading &&
                      !isFilesError &&
                      (!s3FileUrls || s3FileUrls.length === 0) && (
                        <Text align="center">
                          No images found in S3 bucket.
                        </Text>
                      )}

                    <Flex gap="2" justify="center" wrap="wrap">
                      {s3FileData.pages
                        .flatMap((page) =>
                          page.fileUrls.map((url, i) => ({
                            url,
                            name: url.split("/").pop() || "Unknown",
                          })),
                        )
                        .map(({ url, name }, index) => (
                          <Box
                            key={url}
                            style={{
                              width: 100,
                              height: 120,
                              overflow: "hidden",
                              borderRadius: 4,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                            }}
                          >
                            <Image
                              alt={`S3 Image ${index}`}
                              id={`tooltip${index}`}
                              src={url}
                              style={{
                                width: "100%",
                                height: 100,
                                objectFit: "cover",
                                borderRadius: 4,
                              }}
                            />
                            <Text
                              align="center"
                              size="1"
                              style={{
                                wordBreak: "break-all",
                                marginTop: 2,
                                maxWidth: 90,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              title={name}
                            >
                              {name}
                            </Text>
                          </Box>
                        ))}
                    </Flex>
                    <Flex align="center" gap="2" justify="center" mt="3">
                      <Button
                        disabled={!hasNextPage || isFetchingNextPage}
                        onPress={() => fetchNextPage()}
                      >
                        {isFetchingNextPage
                          ? "Loading more..."
                          : hasNextPage
                            ? "Load More"
                            : "Nothing more to load"}
                      </Button>
                    </Flex>
                  </Card>
                </Flex>{" "}
                {/* End of Right Column */}
              </Section>
            )}
        </Section>
      </section>
    </DefaultLayout>
  );
}

const Section = ({ children, ...props }: any) => <div>{children}</div>;
const Flex = ({ children }: any) => <div>{children}</div>;
const Container = ({ children }: any) => <div>{children}</div>;
const Box = ({ children }: any) => <div>{children}</div>;

const Heading = ({ children }: any) => <div>{children}</div>;
const Text = ({ children }: any) => <div>{children}</div>;

const Pagination = ({ children }: any) => <div>{children}</div>;

const Image = (props: any) => {
  return (
    <img
      alt={props.alt || "Unknown image"}
      {...props}
      // onError={e => {
      //   const target = e.currentTarget as HTMLImageElement;
      //   if (target.src !== DEFAULT_IMAGE) {
      //     target.src = DEFAULT_IMAGE;
      //   }
      // }}
    />
  );
};
