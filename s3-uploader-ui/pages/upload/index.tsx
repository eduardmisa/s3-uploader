import { Button } from "@heroui/button";
import { Listbox, ListboxItem } from "@heroui/listbox";
import { cn } from "@heroui/theme";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FolderIcon,
  FileImageIcon,
  HomeIcon,
  PlusCircleIcon,
  UploadIcon,
} from "lucide-react";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@heroui/modal";
import { Image } from "@heroui/image";
import { Input } from "@heroui/input";
import { Card, CardBody, CardFooter, CardHeader } from "@heroui/card";
import { Progress } from "@heroui/progress";

import { Dropzone } from "@/components/Dropzone";
import { FileUploadState } from "@/types";
import { useUploadsManager } from "@/hooks/useUploadsManager";
import { listFilesFromS3, ListFilesResult } from "@/lib/aws-s3";
import DefaultLayout from "@/layouts/default";

export default function UploadPage() {
  const { data: s3FileData } = useQuery<ListFilesResult>({
    queryKey: ["s3Files"],
    queryFn: () => listFilesFromS3(),
  });
  const treeData = convertUrlsToTree(s3FileData?.fileUrls || []);
  const [currentFolder, setCurrentFolder] = useState<TreeNode[]>(treeData);
  const [pathHistory, setPathHistory] = useState<string[]>([]);

  const [newFolderName, setNewFolderName] = useState("");
  const { isOpen, onOpen, onClose: onDisclosureClose } = useDisclosure();
  const onClose = () => {
    onDisclosureClose();
    setNewFolderName("");
  };
  const onCreateFolder = (name: string) => {
    currentFolder.push({
      name,
      type: "folder",
      children: [],
    });
    setCurrentFolder(currentFolder);
    setPathHistory((prev) => [...prev, name]);
    onClose();
  };

  const findNodeInTree = (
    nodes: TreeNode[],
    name: string,
  ): TreeNode | undefined => {
    for (const node of nodes) {
      if (node.name === name) {
        return node;
      }
      if (node.type === "folder" && node.children) {
        const found = findNodeInTree(node.children, name);

        if (found) return found;
      }
    }

    return undefined;
  };

  const handleAction = (key: React.Key, newHistory?: string[]) => {
    if (key === "ROOT") {
      setCurrentFolder(treeData);
      setPathHistory([]);
    }

    if (key === "CreateFolder") {
      onOpen();
    }

    const node = findNodeInTree(treeData, key as string); // Use treeData to find the node

    if (node) {
      if (node.type === "file" && node.url) {
        window.open(node.url, "_blank");
      } else if (node.type === "folder" && node.children) {
        setCurrentFolder(node.children);
        if (!newHistory) setPathHistory((prev) => [...prev, node.name]);
        else setPathHistory([...newHistory]);
      }
    }
  };

  const handleBack = () => {
    if (pathHistory.length === 2) {
      handleAction(pathHistory[0], [pathHistory[0]]);
    } else if (pathHistory.length === 1) {
      handleAction("ROOT");
    } else {
      pathHistory.pop();
      const prev = pathHistory.pop();

      handleAction(prev!, pathHistory);
    }
  };

  const renderNodes = () => {
    return (
      <>
        {currentFolder.map((node) => (
          <ListboxItem
            key={node.name}
            endContent={node.type === "folder" ? <ChevronRight /> : null}
            startContent={
              node.type === "folder" ? <FolderIcon /> : <FileImageIcon />
            }
          >
            {node.name}
          </ListboxItem>
        ))}
      </>
    );
  };

  // FILE UPLOAD *********************************
  const [filesToUpload, setFilesToUpload] = useState<FileUploadState[]>([]);
  const [uploadedFileNames, setUploadedFileNames] = useState<string[]>(() => {
    // TODO: Figure out why this is failing...
    // // Initialize from local storage
    // const stored = window.localStorage?.getItem('uploadedFileNames');
    // return stored ? JSON.parse(stored) : [];
    return [];
  });
  const [overrideExistingFiles, setOverrideExistingFiles] = useState(true);

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
      const isSkipped = isAlreadyUploaded && !overrideExistingFiles;
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
  const skipped = filesToUpload.filter((f) => f.status === "skipped");

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
        <Listbox
          aria-label="Folders Menu"
          className="p-0 gap-0 divide-y divide-default-300/50 dark:divide-default-100/80 bg-content1 max-w-[300px] overflow-visible shadow-small rounded-medium"
          color="success"
          itemClasses={{
            base: "px-3 first:rounded-t-medium last:rounded-b-medium rounded-none gap-3 h-12 data-[hover=true]:bg-default-100/80",
          }}
          variant="flat"
          onAction={handleAction}
        >
          <ListboxItem
            key={"ROOT"}
            isReadOnly
            showDivider
            className="text-center h-auto"
            endContent={
              <Button
                isIconOnly
                size="lg"
                variant="flat"
                onPress={() => handleAction("ROOT")}
              >
                <HomeIcon />
              </Button>
            }
            startContent={
              <Button isIconOnly size="lg" variant="flat" onPress={handleBack}>
                <ChevronLeft />
              </Button>
            }
          >
            {pathHistory[pathHistory.length - 1] || "ROOT"}
          </ListboxItem>

          {renderNodes()}

          <ListboxItem key="CreateFolder" className="text-center h-auto">
            Create folder
            <PlusCircleIcon className="inline mb-1 ml-1" size={17} />
          </ListboxItem>
        </Listbox>

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

      <Modal backdrop={"transparent"} isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Create folder
              </ModalHeader>
              <ModalBody>
                <Input
                  label="Enter folder name"
                  type="text"
                  value={newFolderName}
                  variant="bordered"
                  onChange={(event) => setNewFolderName(event.target.value)}
                />
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  Close
                </Button>
                <Button
                  color="primary"
                  onPress={() => onCreateFolder(newFolderName)}
                >
                  Save
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
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

interface TreeNode {
  name: string;
  type: "folder" | "file";
  url?: string;
  children?: TreeNode[];
}

const convertUrlsToTree = (urls: string[]): TreeNode[] => {
  const tree: TreeNode[] = [];

  urls.forEach((url) => {
    // Derive the key/path from the full URL without relying on any env var.
    // Prefer using the URL API to extract the pathname (works for both S3 and CloudFront domains).
    let pathParts: string[] = [];
    try {
      const parsed = new URL(url);
      pathParts = parsed.pathname.replace(/^\/+/, "").split("/");
      console.log("pathParts", pathParts)
    } catch {
      // Fallback: strip protocol + domain if URL parsing fails
      const withoutDomain = url.replace(/^[^:]+:\/\/[^/]+\/?/, "");
      pathParts = withoutDomain.split("/");
    }
    let currentLevel = tree;

    pathParts.forEach((part, index) => {
      let existingNode = currentLevel.find(
        (node) =>
          node.name === part &&
          (index === pathParts.length - 1
            ? node.type === "file"
            : node.type === "folder"),
      );

      if (!existingNode) {
        existingNode = {
          name: part,
          type: index === pathParts.length - 1 ? "file" : "folder",
          ...(index === pathParts.length - 1 && { url: url }),
          ...(index !== pathParts.length - 1 && { children: [] }),
        };
        currentLevel.push(existingNode);
      }

      if (existingNode.type === "folder") {
        currentLevel = existingNode.children!;
      }
    });
  });

  return tree;
};
