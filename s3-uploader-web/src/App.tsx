import { useState } from 'react';
import { Container, Flex, Heading, Text, Card, Box, Checkbox, Button, Section } from '@radix-ui/themes';
import './App.css'; // Keep App.css for custom styles if needed
import { Dropzone } from './components/Dropzone';
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query'; // Import useInfiniteQuery and InfiniteData
import { ProgressBar } from './components/ProgressBar'; // Import ProgressBar
import { Pagination } from './components/Pagination'; // Import Pagination
import { listImagesFromS3, type ListImagesResult } from './aws-s3'; // Import listImagesFromS3 and ListImagesResult
import { useUploadsManager } from './hooks/useUploadsManager'; // Import useUploadsManager

// Define a type for the file state
export type FileUploadState = {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'uploaded' | 'failed' | 'skipped';
  progress: number;
  // s3Location?: string; // Removed as frontend no longer constructs this
  error?: string;
  preview?: string; // Add preview URL for images
};

function App() {
  const [filesToUpload, setFilesToUpload] = useState<FileUploadState[]>([]);
  const [uploadedFileNames, setUploadedFileNames] = useState<string[]>(() => {
    // Initialize from local storage
    const stored = localStorage.getItem('uploadedFileNames');
    return stored ? JSON.parse(stored) : [];
  });
  const [overrideExistingFiles, setOverrideExistingFiles] = useState(false); // New state for override option

  // States for collapsible cards
  const [isSkippedCollapsed, setIsSkippedCollapsed] = useState(false);
  const [isUploadingCollapsed, setIsUploadingCollapsed] = useState(false);
  const [isQueuedCollapsed, setIsQueuedCollapsed] = useState(false);
  const [isFailedCollapsed, setIsFailedCollapsed] = useState(false);
  const [isUploadedCollapsed, setIsUploadedCollapsed] = useState(false);

  // React Query for S3 image gallery
  const { data: s3GalleryData, isLoading: isGalleryLoading, isError: isGalleryError, error: galleryError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<ListImagesResult, Error, InfiniteData<ListImagesResult>, string[], string | undefined>({
    queryKey: ['s3Images'],
    queryFn: ({ pageParam }) => listImagesFromS3(ITEMS_PER_PAGE, pageParam),
    initialPageParam: undefined, // Start with no continuation token
    getNextPageParam: (lastPage: ListImagesResult) => lastPage.nextContinuationToken, // Explicitly type lastPage
  });

  const s3ImageUrls = s3GalleryData?.pages.flatMap((page: ListImagesResult) => page.imageUrls) || []; // Flatten all pages for display, explicitly type page

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
    const newFiles: FileUploadState[] = acceptedFiles.map(file => {
      const s3Key = (file as any).webkitRelativePath || file.name; // Get the S3 key including path
      const isAlreadyUploaded = uploadedFileNames.includes(s3Key); // Check against S3 key
      const isSkipped = isAlreadyUploaded && !overrideExistingFiles; // Skip only if not overriding
      const isImage = file.type.startsWith('image/');
      return {
        id: `${s3Key}-${file.size}-${file.lastModified}`, // Unique ID based on S3 key
        file,
        status: isSkipped ? 'skipped' : 'queued',
        progress: 0,
        preview: isImage ? URL.createObjectURL(file) : undefined, // Generate preview for images
      };
    });

    // Inform user about skipped files (removed alert, now handled by UI list)
    // const skipped = newFiles.filter(f => f.status === 'skipped');
    // if (skipped.length > 0) {
    //   alert(`Skipped ${skipped.length} files that were already uploaded (use "Override existing files" to re-upload): ${skipped.map(f => f.file.name).join(', ')}`);
    // }

    setFilesToUpload(prev => {
      // Filter out duplicates based on ID before adding
      const existingIds = new Set(prev.map(f => f.id));
      const uniqueNewFiles = newFiles.filter(f => !existingIds.has(f.id));
      return [...prev, ...uniqueNewFiles];
    });
  };


  const queued = filesToUpload.filter(f => f.status === 'queued');
  const uploading = filesToUpload.filter(f => f.status === 'uploading');
  const uploaded = filesToUpload.filter(f => f.status === 'uploaded');
  const failed = filesToUpload.filter(f => f.status === 'failed');
  const skipped = filesToUpload.filter(f => f.status === 'skipped');


  return (
    <Section>
      <Section>
        <Flex justify={"center"}>
          <Container size="4">
            <Flex direction="column" gap="4">
              <Card style={{ width: '100%' }}>
                <Heading as="h1" size="8" align="center">File Uploader</Heading>
                <Flex direction="column" gap="3" align="center">
                  <Text as="div" size="2" mb="2">Drag and drop files here, or click to select files.</Text>
                  <Dropzone onFilesDropped={handleFilesDropped} />
                  <Flex direction={"column"} gapY={"3"} justify="between" align="center">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Checkbox
                        checked={overrideExistingFiles}
                        onCheckedChange={(checked) => setOverrideExistingFiles(checked as boolean)}
                      />
                      <Text size="2">Override existing files</Text>
                    </label>
                    <Button onClick={startUploads} disabled={queued.length === 0} variant="solid" color="green">
                      Start Uploads ({queued.length} queued)
                    </Button>
                  </Flex>
                </Flex>
              </Card>

              {skipped.length > 0 && (
                <Card style={{ width: '100%' }}>
                  <Flex justify="between" align="center" mb="2">
                    <Flex align="center" gap="2">
                      <Heading size="4">Skipped Files ({skipped.length})</Heading>
                      <Button variant="ghost" size="1" onClick={() => setIsSkippedCollapsed(!isSkippedCollapsed)}>
                        {isSkippedCollapsed ? 'Show' : 'Hide'}
                      </Button>
                    </Flex>
                    <Button onClick={() => {
                      setFilesToUpload(prev => prev.map(f =>
                        f.status === 'skipped' ? { ...f, status: 'queued' } : f
                      ));
                    }} variant="outline">
                      Upload Skipped
                    </Button>
                  </Flex>
                  {!isSkippedCollapsed && (
                    <>
                      <Flex direction="column" gap="2" style={{ minHeight: '100px' }}> {/* Changed to min-height, removed overflow */}
                        {skipped.slice((skippedCurrentPage - 1) * ITEMS_PER_PAGE, skippedCurrentPage * ITEMS_PER_PAGE).map(fileState => (
                          <Flex key={fileState.id} align="center" gap="2" className="file-item-enter">
                            {fileState.preview && <img src={fileState.preview} alt="preview" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 4 }} />}
                            <Text size="2" color="gray">
                              {fileState.file.name} - Already uploaded
                            </Text>
                          </Flex>
                        ))}
                      </Flex>
                      {skipped.length > ITEMS_PER_PAGE && (
                        <Pagination
                          currentPage={skippedCurrentPage}
                          totalPages={Math.ceil(skipped.length / ITEMS_PER_PAGE)}
                          onPageChange={setSkippedCurrentPage}
                        />
                      )}
                    </>
                  )}
                </Card>
              )}

              {uploading.length > 0 && (
                <Card style={{ width: '100%' }}>
                  <Flex justify="between" align="center" mb="2">
                    <Flex align="center" gap="2">
                      <Heading size="4">Uploading ({uploading.length})</Heading>
                      <Button variant="ghost" size="1" onClick={() => setIsUploadingCollapsed(!isUploadingCollapsed)}>
                        {isUploadingCollapsed ? 'Show' : 'Hide'}
                      </Button>
                    </Flex>
                  </Flex>
                  {!isUploadingCollapsed && (
                    <>
                      <Flex direction="column" gap="2" style={{ minHeight: '100px' }}> {/* Changed to min-height, removed overflow */}
                        {uploading.slice((uploadingCurrentPage - 1) * ITEMS_PER_PAGE, uploadingCurrentPage * ITEMS_PER_PAGE).map(fileState => (
                          <Flex key={fileState.id} align="center" gap="2" className="file-item-enter">
                            {fileState.preview && <img src={fileState.preview} alt="preview" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 4 }} />}
                            <Box>
                              <Text size="2">{fileState.file.name}</Text>
                              <ProgressBar value={fileState.progress} />
                            </Box>
                          </Flex>
                        ))}
                      </Flex>
                      {uploading.length > ITEMS_PER_PAGE && (
                        <Pagination
                          currentPage={uploadingCurrentPage}
                          totalPages={Math.ceil(uploading.length / ITEMS_PER_PAGE)}
                          onPageChange={setUploadingCurrentPage}
                        />
                      )}
                    </>
                  )}
                </Card>
              )}

              {queued.length > 0 && (
                <Card style={{ width: '100%' }}>
                  <Flex justify="between" align="center" mb="2">
                    <Flex align="center" gap="2">
                      <Heading size="4">Queued ({queued.length})</Heading>
                      <Button variant="ghost" size="1" onClick={() => setIsQueuedCollapsed(!isQueuedCollapsed)}>
                        {isQueuedCollapsed ? 'Show' : 'Hide'}
                      </Button>
                    </Flex>
                  </Flex>
                  {!isQueuedCollapsed && (
                    <>
                      <Flex direction="column" gap="2" style={{ minHeight: '100px' }}> {/* Changed to min-height, removed overflow */}
                        {queued.slice((queuedCurrentPage - 1) * ITEMS_PER_PAGE, queuedCurrentPage * ITEMS_PER_PAGE).map(fileState => (
                          <Flex key={fileState.id} align="center" gap="2" className="file-item-enter">
                            {fileState.preview && <img src={fileState.preview} alt="preview" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 4 }} />}
                            <Text size="2">
                              {fileState.file.name}
                            </Text>
                          </Flex>
                        ))}
                      </Flex>
                      {queued.length > ITEMS_PER_PAGE && (
                        <Pagination
                          currentPage={queuedCurrentPage}
                          totalPages={Math.ceil(queued.length / ITEMS_PER_PAGE)}
                          onPageChange={setQueuedCurrentPage}
                        />
                      )}
                    </>
                  )}
                </Card>
              )}

              {failed.length > 0 && (
                <Card style={{ width: '100%' }}>
                  <Flex justify="between" align="center" mb="2">
                    <Flex align="center" gap="2">
                      <Heading size="4" color="red">Failed ({failed.length})</Heading>
                      <Button variant="ghost" size="1" onClick={() => setIsFailedCollapsed(!isFailedCollapsed)}>
                        {isFailedCollapsed ? 'Show' : 'Hide'}
                      </Button>
                    </Flex>
                  </Flex>
                  {!isFailedCollapsed && (
                    <>
                      <Flex direction="column" gap="2" style={{ minHeight: '100px' }}> {/* Changed to min-height, removed overflow */}
                        {failed.slice((failedCurrentPage - 1) * ITEMS_PER_PAGE, failedCurrentPage * ITEMS_PER_PAGE).map(fileState => (
                          <Flex key={fileState.id} align="center" gap="2" className="file-item-enter">
                            {fileState.preview && <img src={fileState.preview} alt="preview" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 4 }} />}
                            <Text size="2" color="red">
                              {fileState.file.name} - {fileState.error || 'Unknown error'}
                            </Text>
                          </Flex>
                        ))}
                      </Flex>
                      {failed.length > ITEMS_PER_PAGE && (
                        <Pagination
                          currentPage={failedCurrentPage}
                          totalPages={Math.ceil(failed.length / ITEMS_PER_PAGE)}
                          onPageChange={setFailedCurrentPage}
                        />
                      )}
                    </>
                  )}
                </Card>
              )}

              {uploaded.length > 0 && (
                <Card style={{ width: '100%' }}>
                  <Flex justify="between" align="center" mb="2">
                    <Flex align="center" gap="2">
                      <Heading size="4">Uploaded ({uploaded.length})</Heading>
                      <Button variant="ghost" size="1" onClick={() => setIsUploadedCollapsed(!isUploadedCollapsed)}>
                        {isUploadedCollapsed ? 'Show' : 'Hide'}
                      </Button>
                    </Flex>
                  </Flex>
                  {!isUploadedCollapsed && (
                    <>
                      <Flex direction="column" gap="2" style={{ minHeight: '100px' }}> {/* Changed to min-height, removed overflow */}
                        {uploaded.slice((uploadedCurrentPage - 1) * ITEMS_PER_PAGE, uploadedCurrentPage * ITEMS_PER_PAGE).map(fileState => (
                          <Flex key={fileState.id} align="center" gap="2" className="file-item-enter">
                            {fileState.preview && <img src={fileState.preview} alt="preview" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 4 }} />}
                            <Text size="2" color="green">
                              {fileState.file.name} - Uploaded
                            </Text>
                          </Flex>
                        ))}
                      </Flex>
                      {uploaded.length > ITEMS_PER_PAGE && (
                        <Pagination
                          currentPage={uploadedCurrentPage}
                          totalPages={Math.ceil(uploaded.length / ITEMS_PER_PAGE)}
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
      {!isGalleryLoading && !isGalleryError && s3GalleryData && s3GalleryData.pages.length > 0 && (
        <Section>
          <Flex justify={"center"}>
            <Card>
              <Heading as="h1" size="8" align="center">Gallery</Heading>
              <br />
              {isGalleryLoading && <Text align="center">Loading images...</Text>}
              {isGalleryError && <Text align="center" color="red">{(galleryError as any)?.message || "Failed to load images from S3."}</Text>}
              {!isGalleryLoading && !isGalleryError && (!s3ImageUrls || s3ImageUrls.length === 0) && (
                <Text align="center">No images found in S3 bucket.</Text>
              )}

              <Flex wrap="wrap" gap="2" justify="center">
                {s3GalleryData.pages.flatMap(page => page.imageUrls).map((url: string, index: number) => (
                  <Box key={url} style={{ width: 100, height: 100, overflow: 'hidden', borderRadius: 4 }}>
                    <img src={url} alt={`S3 Image ${index}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </Box>
                ))}
              </Flex>
              <Flex justify="center" align="center" gap="2" mt="3">
                <Button variant="outline" size="1" onClick={() => fetchNextPage()} disabled={!hasNextPage || isFetchingNextPage}>
                  {isFetchingNextPage ? 'Loading more...' : hasNextPage ? 'Load More' : 'Nothing more to load'}
                </Button>
              </Flex>
            </Card>

          </Flex> {/* End of Right Column */}
        </Section>
      )}
    </Section>
  );
}

export default App;
